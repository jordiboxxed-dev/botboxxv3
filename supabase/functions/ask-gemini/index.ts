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
    const { agentId, prompt, history, systemPrompt } = await req.json();
    const apiKey = Deno.env.get("GEMINI_API_KEY");

    if (!apiKey) throw new Error("GEMINI_API_KEY no está configurada.");
    if (!agentId || !prompt) throw new Error("agentId y prompt son requeridos.");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? '',
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ''
    );
    const genAI = new GoogleGenerativeAI(apiKey);
    const embeddingModel = genAI.getGenerativeModel({ model: "text-embedding-004" });
    
    const generativeModel = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
    });

    // 1. Fetch knowledge context
    const { data: sources, error: sourcesError } = await supabaseAdmin
      .from("knowledge_sources")
      .select("id")
      .eq("agent_id", agentId);
    if (sourcesError) throw sourcesError;
    const sourceIds = sources.map(s => s.id);

    let context = "No se encontró información relevante en la base de conocimiento.";
    if (sourceIds.length > 0) {
      const promptEmbedding = await embeddingModel.embedContent(prompt);
      const { data: chunks, error: matchError } = await supabaseAdmin.rpc('match_knowledge_chunks', {
        query_embedding: promptEmbedding.embedding.values,
        match_threshold: 0.6, // Reducido para ser más inclusivo
        match_count: 20,     // Aumentado para obtener más contexto
        source_ids: sourceIds
      });
      if (matchError) throw matchError;
      if (chunks && chunks.length > 0) {
        context = chunks.map(c => c.content).join("\n\n---\n\n");
      }
    }

    const metaPrompt = `
Tu rol es ser un asistente experto que combina la información específica proporcionada con tu conocimiento general.

**Directrices de Respuesta:**
1.  **Prioridad al Contexto:** Tu fuente de verdad principal es el "Contexto Relevante de la Base de Conocimiento". Siempre que la pregunta se relacione con el contexto, basa tu respuesta firmemente en él.
2.  **Conocimiento General Permitido:** Si la pregunta es de naturaleza general y no se encuentra en el contexto, puedes usar tu conocimiento más amplio para responder.
3.  **Integración Inteligente:** Combina la información del contexto con tu conocimiento general para dar respuestas completas y útiles, pero siempre dando preferencia a los datos proporcionados.
4.  **Sigue la Personalidad:** Adopta la personalidad y el tono descritos en las "Instrucciones Base del Agente".

---

**Contexto Relevante de la Base de Conocimiento:**
${context}

---

**Instrucciones Base del Agente (Personalidad y Tono):**
${systemPrompt}
`;

    const chat = generativeModel.startChat({
        history: [
            { role: "user", parts: [{ text: metaPrompt }] },
            { role: "model", parts: [{ text: "Entendido. Priorizaré el contexto proporcionado y usaré mi conocimiento general cuando sea apropiado, manteniendo siempre la personalidad del agente." }] },
            ...(history || []).map(msg => ({
                role: msg.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: msg.content }]
            }))
        ],
    });

    const result = await chat.sendMessageStream(prompt);

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        for await (const chunk of result.stream) {
          const text = chunk.text();
          if (text) {
            controller.enqueue(encoder.encode(text));
          }
        }
        controller.close();
      },
    });

    return new Response(stream, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });

  } catch (error) {
    console.error("Error in ask-gemini function:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});