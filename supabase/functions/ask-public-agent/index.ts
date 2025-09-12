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
    const { agentId, prompt, history, conversationId } = await req.json();
    const openRouterApiKey = Deno.env.get("OPENROUTER_API_KEY");
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");

    if (!openRouterApiKey) throw new Error("OPENROUTER_API_KEY no está configurada.");
    if (!geminiApiKey) throw new Error("GEMINI_API_KEY no está configurada para embeddings.");
    if (!agentId || !prompt || !conversationId) {
      throw new Error("agentId, prompt y conversationId son requeridos.");
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? '',
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ''
    );
    
    const { data: agentData, error: agentError } = await supabaseAdmin.from("agents").select("system_prompt, user_id, company_name, status, deleted_at, model").eq("id", agentId).single();
    if (agentError) throw new Error("No se pudo encontrar el agente.");
    if (agentData.status !== 'active' || agentData.deleted_at) {
      throw new Error("Este agente no está activo y no puede recibir mensajes.");
    }
    
    const { user_id: agentOwnerId } = agentData;

    const { data: profileData, error: profileError } = await supabaseAdmin.from('profiles').select('plan, trial_ends_at, role').eq('id', agentOwnerId).single();
    if (profileError) throw new Error("No se pudo verificar el perfil del propietario del agente.");

    if (profileData.role !== 'admin' && profileData.plan === 'trial') {
      if (profileData.trial_ends_at && new Date(profileData.trial_ends_at) < new Date()) {
        throw new Error("El período de prueba para este agente ha expirado. El propietario necesita actualizar su plan.");
      }
      const TRIAL_MESSAGE_LIMIT = 150;
      const { data: usageData, error: usageError } = await supabaseAdmin.from('usage_stats').select('messages_sent').eq('user_id', agentOwnerId);
      if (usageError) throw new Error("No se pudo verificar el uso de mensajes del propietario del agente.");
      const totalMessagesSent = usageData.reduce((sum, record) => sum + record.messages_sent, 0);
      if (totalMessagesSent >= TRIAL_MESSAGE_LIMIT) {
        throw new Error(`Límite total de mensajes del plan de prueba (${TRIAL_MESSAGE_LIMIT}) alcanzado. El propietario necesita actualizar su plan.`);
      }
    }

    await supabaseAdmin.from("public_conversations").upsert({ id: conversationId, agent_id: agentId, user_id: agentOwnerId });
    await supabaseAdmin.from("public_messages").insert({ conversation_id: conversationId, role: "user", content: prompt });

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

    const personalityPrompt = agentData.system_prompt || "Eres un asistente de IA servicial.";
    const companyName = agentData.company_name || "la empresa";

    const finalSystemPrompt = `
### INSTRUCCIONES DE PERSONALIDAD ###
Adopta la siguiente personalidad. Reemplaza [Nombre de la Empresa] con "${companyName}".
---
${personalityPrompt}
---

### TAREA PRINCIPAL Y REGLAS INQUEBRANTABLES ###
Tu única tarea es responder a la pregunta del usuario utilizando EXCLUSIVAMENTE la "BASE DE CONOCIMIENTO" que se te proporciona a continuación.

1.  **ÚNICA FUENTE:** Basa el 100% de tu respuesta en la "BASE DE CONOCIMIENTO". No uses ninguna otra información, ni siquiera de tus instrucciones de personalidad si contradicen esto.
2.  **RESPUESTA DIRECTA:** Si encuentras la respuesta, preséntala de forma clara y directa.
3.  **SI NO SABES, DI ESTO:** Si la respuesta a la pregunta del usuario no está explícitamente en la "BASE DE CONOCIMIENTO", tu única respuesta permitida es: "Lo siento, no tengo información sobre ese tema en mi base de conocimiento." No añadas nada más. No te disculpes de otra forma. No intentes adivinar.

### BASE DE CONOCIMIENTO ###
---
${context}
---

Ahora, responde la pregunta del usuario basándote únicamente en la información anterior.
    `;
    
    const messages = [
      { role: "system", content: finalSystemPrompt },
      ...((history || []).slice(-6)).map(msg => ({
          role: msg.role,
          content: msg.content
      })),
      { role: "user", content: prompt }
    ];

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
        stream: true
      })
    });

    if (!openRouterResponse.ok) {
      const errorBody = await openRouterResponse.json();
      throw new Error(`Error de OpenRouter: ${errorBody.error.message}`);
    }

    let fullResponseText = "";
    const [stream1, stream2] = openRouterResponse.body.tee();

    (async () => {
      const reader = stream2.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter(line => line.trim() !== '');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.substring(6);
            if (data !== '[DONE]') {
              try {
                const json = JSON.parse(data);
                const content = json.choices[0]?.delta?.content;
                if (content) {
                  fullResponseText += content;
                }
              } catch (e) {}
            }
          }
        }
      }
      await supabaseAdmin.from("public_messages").insert({ conversation_id: conversationId, role: "assistant", content: fullResponseText });
    })();

    if (profileData.role !== 'admin') {
      await supabaseAdmin.rpc('increment_message_count', { p_user_id: agentOwnerId });
    }
    
    const stream = new ReadableStream({
      async start(controller) {
        const reader = stream1.getReader();
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
              } catch (e) {}
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
    console.error("Error in ask-public-agent function:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});