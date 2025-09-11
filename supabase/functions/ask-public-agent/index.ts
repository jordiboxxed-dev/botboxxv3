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

const FALLBACK_TRIGGER_PHRASE = "No he encontrado información sobre eso en mi base de conocimiento.";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
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

    // --- Verificación de Plan y Límites ---
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

    const genAI = new GoogleGenerativeAI(apiKey);
    const embeddingModel = genAI.getGenerativeModel({ model: "text-embedding-004" });
    const generativeModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash", safetySettings });

    const { system_prompt: rawSystemPrompt, company_name: companyName } = agentData;
    const systemPrompt = (rawSystemPrompt || "Eres un asistente de IA servicial.").replace(/\[Nombre de la Empresa\]/g, companyName || "la empresa");

    // --- PASO 1: Búsqueda Especializada (RAG) ---
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

    const metaPrompt = `
      **ROL Y OBJETIVO:** Eres un asistente de IA experto cuya única función es responder preguntas basándose ESTRICTAMENTE en el contexto proporcionado.
      **REGLAS CRÍTICAS:**
      - **NUNCA uses conocimiento externo.**
      - **Si la información NO está en el 'Contexto', tu única respuesta permitida es:** "${FALLBACK_TRIGGER_PHRASE}"
      ---
      **Contexto de la Base de Conocimiento:**
      ${context}
      ---
      **Instrucciones del Agente (Personalidad y Tono):**
      ${systemPrompt}
    `;
    
    const strictHistory = [
      { role: "user", parts: [{ text: metaPrompt }] },
      { role: "model", parts: [{ text: "Entendido. Mi conocimiento se limita estrictamente al contexto proporcionado." }] },
      ...((history || []).slice(-6)).map(msg => ({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.content }]
      }))
    ];

    const strictChat = generativeModel.startChat({ history: strictHistory });
    const strictResult = await strictChat.sendMessage(prompt);
    const strictResponseText = strictResult.response.text();

    let finalStream;
    let finalResponseText = "";

    if (!strictResponseText.includes(FALLBACK_TRIGGER_PHRASE)) {
      // --- ÉXITO: La respuesta está en el contexto ---
      console.log("RAG successful. Answering from context.");
      finalResponseText = strictResponseText;
      finalStream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(finalResponseText));
          controller.close();
        }
      });
    } else {
      // --- PASO 2: Fallback a Conocimiento General ---
      console.log("RAG failed. Falling back to general knowledge.");
      const generalHistory = [
        { role: "user", parts: [{ text: systemPrompt }] },
        { role: "model", parts: [{ text: "Entendido. Actuaré como el asistente descrito." }] },
        ...((history || []).slice(-6)).map(msg => ({
            role: msg.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: msg.content }]
        }))
      ];
      const generalChat = generativeModel.startChat({ history: generalHistory });
      const generalResult = await generalChat.sendMessageStream(prompt);
      
      // Convertir el generador asíncrono a un ReadableStream que se pueda duplicar (tee)
      const readableStream = new ReadableStream({
        async start(controller) {
          const encoder = new TextEncoder();
          for await (const chunk of generalResult.stream) {
            const text = chunk.text();
            if (text) {
              controller.enqueue(encoder.encode(text));
            }
          }
          controller.close();
        },
      });

      const [stream1, stream2] = readableStream.tee();
      finalStream = stream1;

      // Leer el stream2 para obtener el texto completo y guardarlo en la DB
      (async () => {
        const reader = stream2.getReader();
        const decoder = new TextDecoder();
        let fullText = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          fullText += decoder.decode(value, { stream: true });
        }
        await supabaseAdmin.from("public_messages").insert({ conversation_id: conversationId, role: "assistant", content: fullText });
      })();
    }

    if (profileData.role !== 'admin') {
      await supabaseAdmin.rpc('increment_message_count', { p_user_id: agentOwnerId });
    }
    
    // Si la respuesta fue del contexto, la guardamos ahora. Si fue del stream, ya se está guardando.
    if (finalResponseText) { // Se guarda solo si no es un stream
        await supabaseAdmin.from("public_messages").insert({ conversation_id: conversationId, role: "assistant", content: finalResponseText });
    }

    return new Response(finalStream, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });

  } catch (error) {
    console.error("Error in ask-public-agent function:", error);
    let errorMessage = error.message || "Ocurrió un error desconocido.";
    // ... (manejo de errores específicos)
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});