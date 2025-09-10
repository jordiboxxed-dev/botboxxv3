// @ts-nocheck
// Force redeploy v3 - Forcing gemini-1.5-flash to address cost issues.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "https://esm.sh/@google/generative-ai";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const safetySettings = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    console.log("--- ask-public-agent function invoked: Enforcing use of gemini-1.5-flash ---");
    const { agentId, prompt, history, conversationId } = await req.json();
    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) throw new Error("GEMINI_API_KEY no está configurada.");
    if (!agentId || !prompt || !conversationId) {
      throw new Error("agentId, prompt y conversationId son requeridos.");
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? '',
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ''
    );
    
    const { data: agentData, error: agentError } = await supabaseAdmin.from("agents").select("system_prompt, user_id, company_name, status, deleted_at").eq("id", agentId).single();
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
      const { data: usageData, error: usageError } = await supabaseAdmin
        .from('usage_stats')
        .select('messages_sent')
        .eq('user_id', agentOwnerId);

      if (usageError) throw new Error("No se pudo verificar el uso de mensajes del propietario del agente.");

      const totalMessagesSent = usageData.reduce((sum, record) => sum + record.messages_sent, 0);

      if (totalMessagesSent >= TRIAL_MESSAGE_LIMIT) {
        throw new Error(`Límite total de mensajes del plan de prueba (${TRIAL_MESSAGE_LIMIT}) alcanzado. El propietario necesita actualizar su plan.`);
      }
    }

    await supabaseAdmin.from("public_conversations").upsert({ id: conversationId, agent_id: agentId, user_id: agentOwnerId });
    await supabaseAdmin.from("public_messages").insert({ conversation_id: conversationId, role: "user", content: prompt });

    const genAI = new GoogleGenerativeAI(apiKey);
    const embeddingModel = genAI.getGenerativeModel({ model: "text-embedding-004" });
    
    console.log("Initializing chat model with 'gemini-1.5-flash'.");
    const chatModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash", safetySettings });

    const { system_prompt: rawSystemPrompt, company_name: companyName } = agentData;
    const systemPrompt = (rawSystemPrompt || "Eres un asistente de IA servicial.").replace(/\[Nombre de la Empresa\]/g, companyName || "la empresa");

    const { data: sources, error: sourcesError } = await supabaseAdmin.from("knowledge_sources").select("id").eq("agent_id", agentId);
    if (sourcesError) throw sourcesError;
    const sourceIds = sources.map(s => s.id);

    let context = "No se encontró información relevante en la base de conocimiento.";
    if (sourceIds.length > 0) {
        const promptEmbedding = await embeddingModel.embedContent(prompt);
        const { data: chunks, error: matchError } = await supabaseAdmin.rpc('match_knowledge_chunks', {
            query_embedding: promptEmbedding.embedding.values,
            match_threshold: 0.65,
            match_count: 5,
            source_ids: sourceIds
        });
        if (matchError) throw matchError;
        if (chunks && chunks.length > 0) {
            context = chunks.map(c => c.content).join("\n\n---\n\n");
        }
    }

    const formattedHistory = (history || []).slice(-6).map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    }));
    
    const fullHistory = [
      { role: "user", parts: [{ text: `
        **Instrucción Principal e Inalterable:** Tu única y exclusiva fuente de verdad es el texto proporcionado en la sección 'Contexto'. Debes basar tus respuestas ÚNICAMENTE en esta información. NUNCA inventes información ni utilices conocimiento externo.

        **Contexto de la Base de Conocimiento (Tu ÚNICA fuente de verdad):**
        ${context}
        ---
        **Instrucciones del Agente (Personalidad y Tono):**
        ${systemPrompt}
        ---
        **Manejo de Conversación y Contexto:**
        - Antes de responder, revisa el historial de la conversación.
        - Si la pregunta actual es corta o una continuación (ej: "¿y el de 9000?", "¿y el otro?"), utiliza el contexto de los mensajes anteriores para entender la pregunta completa. Por ejemplo, si la pregunta anterior fue sobre "inverter de 12000", y la nueva es "¿y el de 9000?", debes entender que el usuario está preguntando por el "inverter de 9000".
        ---
        **Reglas de Respuesta:**
        1.  Si la respuesta a la pregunta del usuario se encuentra en el 'Contexto', responde utilizando esa información de manera precisa.
        2.  Si la respuesta no se encuentra en el 'Contexto', debes decir CLARAMENTE que no encontraste la información en tu base de conocimiento. NO des respuestas genéricas como "No tengo acceso a precios en tiempo real". Di "No encontré la información sobre [tema de la pregunta] en mi base de conocimiento."
        3.  Ejemplo: Si el usuario pregunta 'precio de la Italy 8100' y el contexto dice 'Producto: Italy 8100 Plus..., Precio: 2,462.00', tu respuesta debe ser 'El precio de la Italy 8100 Plus es 2,462.00'.
      ` }] },
      { role: "model", parts: [{ text: "Entendido. Basaré mis respuestas únicamente en el contexto proporcionado y recordaré el historial de la conversación para entender preguntas de seguimiento." }] },
      ...formattedHistory,
      { role: "user", parts: [{ text: prompt }] }
    ];

    let result;
    const maxRetries = 5;
    for (let i = 0; i < maxRetries; i++) {
      try {
        result = await chatModel.generateContentStream({ contents: fullHistory });
        break;
      } catch (error) {
        if (i === maxRetries - 1) throw error;
        const delay = Math.pow(2, i) * 1000 + Math.random() * 1000;
        console.log(`Attempt ${i + 1} failed. Retrying in ${Math.round(delay)}ms...`);
        await new Promise(res => setTimeout(res, delay));
      }
    }

    if (profileData.role !== 'admin') {
      await supabaseAdmin.rpc('increment_message_count', { p_user_id: agentOwnerId });
    }

    let fullResponse = "";
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        for await (const chunk of result.stream) {
          const text = chunk.text();
          if (text) {
            fullResponse += text;
            controller.enqueue(encoder.encode(text));
          }
        }
        await supabaseAdmin.from("public_messages").insert({ conversation_id: conversationId, role: "assistant", content: fullResponse });
        controller.close();
      },
    });

    return new Response(stream, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });

  } catch (error) {
    console.error("Error in ask-public-agent function:", error);
    let errorMessage = error.message || "Ocurrió un error desconocido.";
    
    if (errorMessage.includes("429") && errorMessage.includes("quota")) {
        errorMessage = "Se ha excedido el límite de solicitudes de la API de IA (plan gratuito). Por favor, espera a que se reinicie la cuota diaria o actualiza el plan de facturación de Google Cloud.";
    } else if (errorMessage.includes("503") || errorMessage.toLowerCase().includes("overloaded")) {
        errorMessage = "El servicio de IA está experimentando una alta demanda en este momento. Por favor, inténtalo de nuevo en unos momentos.";
    } else if (errorMessage.includes("API key not valid")) {
        errorMessage = "La clave de API para el servicio de IA no es válida. Por favor, verifica la configuración.";
    }

    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});