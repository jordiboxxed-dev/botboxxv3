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
    // 1. Get Authenticated User
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

    const { agentId, prompt, history, systemPrompt } = await req.json();
    const apiKey = Deno.env.get("GEMINI_API_KEY");

    if (!apiKey) throw new Error("GEMINI_API_KEY no está configurada.");
    if (!agentId || !prompt) throw new Error("agentId y prompt son requeridos.");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? '',
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ''
    );

    // 2. Check Usage Limits (Bypass for Admins)
    const { data: profileData, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('plan, trial_ends_at, role') // Fetch role as well
      .eq('id', user.id)
      .single();

    if (profileError) throw new Error("No se pudo verificar el perfil del usuario.");

    // If the user is not an admin, enforce limits
    if (profileData.role !== 'admin') {
      const TRIAL_MESSAGE_LIMIT = 150;
      const currentMonthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

      if (profileData.plan === 'trial') {
        if (profileData.trial_ends_at && new Date(profileData.trial_ends_at) < new Date()) {
          throw new Error("Tu período de prueba ha expirado. Por favor, actualiza tu plan para continuar.");
        }

        const { data: usageData } = await supabaseAdmin
          .from('usage_stats')
          .select('messages_sent')
          .eq('user_id', user.id)
          .eq('month_start', currentMonthStart)
          .single();
        
        const messagesSent = usageData?.messages_sent || 0;
        if (messagesSent >= TRIAL_MESSAGE_LIMIT) {
          throw new Error(`Has alcanzado el límite de ${TRIAL_MESSAGE_LIMIT} mensajes de tu plan de prueba. Por favor, actualiza tu plan.`);
        }
      }
    }

    // 3. Proceed with existing logic
    const genAI = new GoogleGenerativeAI(apiKey);
    const embeddingModel = genAI.getGenerativeModel({ model: "text-embedding-004" });
    const generativeModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

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
        match_threshold: 0.6,
        match_count: 20,
        source_ids: sourceIds
      });
      if (matchError) throw matchError;
      if (chunks && chunks.length > 0) {
        context = chunks.map(c => c.content).join("\n\n---\n\n");
      }
    }

    const metaPrompt = `
      Tu rol es ser un asistente experto...
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
            { role: "model", parts: [{ text: "Entendido." }] },
            ...(history || []).map(msg => ({
                role: msg.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: msg.content }]
            }))
        ],
    });

    const result = await chat.sendMessageStream(prompt);

    // 4. Increment message count (also bypassed for admins for consistency, though not strictly necessary)
    if (profileData.role !== 'admin') {
      const { error: incrementError } = await supabaseAdmin.rpc('increment_message_count', { p_user_id: user.id });
      if (incrementError) {
        console.error('Failed to increment message count:', incrementError);
      }
    }

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
      status: 403, // Forbidden
    });
  }
});