// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error("Falta el encabezado de autorización.");
    const token = authHeader.replace('Bearer ', '');
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? '',
      Deno.env.get("SUPABASE_ANON_KEY") ?? '',
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error("Token de usuario inválido.");

    const { agentId, prompt, history } = await req.json();
    if (!agentId || !prompt) throw new Error("agentId y prompt son requeridos.");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? '',
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ''
    );

    // --- Verificación de Plan y Límites ---
    const { data: profileData, error: profileError } = await supabaseAdmin.from('profiles').select('plan, trial_ends_at, role').eq('id', user.id).single();
    if (profileError) throw new Error("No se pudo verificar el perfil del usuario.");

    if (profileData.role !== 'admin' && profileData.plan === 'trial') {
      if (profileData.trial_ends_at && new Date(profileData.trial_ends_at) < new Date()) {
        throw new Error("Tu período de prueba ha expirado. Por favor, actualiza tu plan para continuar.");
      }
      const TRIAL_MESSAGE_LIMIT = 150;
      const { data: usageData, error: usageError } = await supabaseAdmin.from('usage_stats').select('messages_sent').eq('user_id', user.id);
      if (usageError) throw new Error("No se pudo verificar el uso de mensajes.");
      const totalMessagesSent = usageData.reduce((sum, record) => sum + record.messages_sent, 0);
      if (totalMessagesSent >= TRIAL_MESSAGE_LIMIT) {
        throw new Error(`Has alcanzado el límite total de ${TRIAL_MESSAGE_LIMIT} mensajes de tu período de prueba. Por favor, actualiza tu plan.`);
      }
    }

    // --- Obtener datos del Agente ---
    const { data: agentData, error: agentError } = await supabaseAdmin.from("agents").select("system_prompt, model, company_name, webhook_url").eq("id", agentId).single();
    if (agentError) throw new Error("No se pudo encontrar el agente.");

    // --- Obtener Contexto de la Base de Conocimiento ---
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiApiKey) throw new Error("GEMINI_API_KEY no está configurada para embeddings.");
    const genAI = new GoogleGenerativeAI(geminiApiKey);
    const embeddingModel = genAI.getGenerativeModel({ model: "text-embedding-004" });

    const { data: sources, error: sourcesError } = await supabaseAdmin.from("knowledge_sources").select("id").eq("agent_id", agentId);
    if (sourcesError) throw sourcesError;
    const sourceIds = sources.map(s => s.id);

    let context = "No se encontró información relevante en la base de conocimiento.";
    if (sourceIds.length > 0) {
      const promptEmbedding = await embeddingModel.embedContent(prompt);
      const { data: chunks, error: matchError } = await supabaseAdmin.rpc('match_knowledge_chunks', {
        query_embedding: promptEmbedding.embedding.values,
        match_threshold: 0.5,
        match_count: 10,
        source_ids: sourceIds
      });
      if (matchError) throw matchError;
      if (chunks && chunks.length > 0) {
        context = chunks.map(c => c.content).join("\n\n---\n\n");
      }
    }

    // --- Lógica Condicional: Webhook o IA Interna ---
    let responseStream;

    if (agentData.webhook_url) {
      // --- Lógica de Webhook ---
      const webhookResponse = await fetch(agentData.webhook_url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId,
          prompt,
          history: (history || []).slice(-4),
          context,
        }),
      });

      if (!webhookResponse.ok) {
        const errorBody = await webhookResponse.text();
        console.error("Webhook error response:", errorBody);
        throw new Error(`El webhook devolvió un error: ${webhookResponse.statusText}`);
      }
      
      const webhookJson = await webhookResponse.json();
      const responseText = webhookJson.output;

      if (typeof responseText !== 'string') {
        throw new Error("La respuesta del webhook no contenía un campo 'output' de tipo texto.");
      }

      // Convertir el texto final en un stream para que coincida con el formato esperado
      responseStream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(responseText));
          controller.close();
        }
      });

    } else {
      // --- Lógica de IA Interna (OpenRouter) ---
      const openRouterApiKey = Deno.env.get("OPENROUTER_API_KEY");
      if (!openRouterApiKey) throw new Error("OPENROUTER_API_KEY no está configurada.");

      const personalityPrompt = agentData.system_prompt || "Eres un asistente de IA servicial.";
      const companyName = agentData.company_name || "la empresa";
      const finalSystemPrompt = `
Eres un agente de inteligencia artificial especializado en proporcionar respuestas precisas basadas en una base de conocimiento específica. Tu comportamiento está definido por las siguientes reglas inquebrantables:
1.  **Identidad y Personalidad:**
    *   Tu nombre es un agente de ${companyName}.
    *   Adopta la siguiente personalidad: ${personalityPrompt}
2.  **Proceso de Respuesta (Reglas Obligatorias):**
    *   **PASO 1:** Busca en la "BASE DE CONOCIMIENTO" proporcionada cualquier información relevante a la pregunta del usuario.
    *   **PASO 2:** Si encuentras información, formula una respuesta basada ÚNICAMENTE en esa información. Si no, tu única respuesta permitida es: "Lo siento, no tengo información sobre ese tema en mi base de conocimiento."
### BASE DE CONOCIMIENTO ###
---
${context}
---
### HISTORIAL DE LA CONVERSACIÓN ###
${(history || []).slice(-4).map(msg => `${msg.role}: ${msg.content}`).join('\n')}
### PREGUNTA DEL USUARIO ###
${prompt}
### TU RESPUESTA (SOLO EL TEXTO DE LA RESPUESTA) ###
`;
      const messages = [{ role: "system", content: finalSystemPrompt }];

      const openRouterResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${openRouterApiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://botboxx-demov2.vercel.app",
          "X-Title": "BotBoxx"
        },
        body: JSON.stringify({
          model: agentData.model || 'mistralai/mistral-7b-instruct',
          messages: messages,
          stream: true,
          temperature: 0.2,
        })
      });

      if (!openRouterResponse.ok) {
        const errorBody = await openRouterResponse.json();
        throw new Error(`Error de OpenRouter: ${errorBody.error.message}`);
      }
      responseStream = openRouterResponse.body;
    }

    // --- Incrementar contador de mensajes y devolver stream ---
    if (profileData.role !== 'admin') {
      await supabaseAdmin.rpc('increment_message_count', { p_user_id: user.id });
    }

    const stream = new ReadableStream({
      async start(controller) {
        const reader = responseStream.getReader();
        const decoder = new TextDecoder();
        const encoder = new TextEncoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n').filter(line => line.trim() !== '');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.substring(6);
              if (data === '[DONE]') {
                controller.close();
                return;
              }
              try {
                const json = JSON.parse(data);
                const content = json.choices[0]?.delta?.content;
                if (content) {
                  controller.enqueue(encoder.encode(content));
                }
              } catch (e) {
                // Si no es un JSON de OpenRouter (ej. stream directo de webhook), lo pasamos tal cual.
                controller.enqueue(value);
                break;
              }
            } else {
               // Si no es un evento SSE, pasamos el chunk directamente.
               controller.enqueue(value);
               break;
            }
          }
        }
        controller.close();
      }
    });

    return new Response(stream, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });

  } catch (error) {
    console.error("Error in ask-agent function:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});