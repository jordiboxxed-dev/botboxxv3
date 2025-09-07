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
    const apiKey = Deno.env.get("GEMINI_API_KEY");

    if (!apiKey) throw new Error("GEMINI_API_KEY no está configurada.");
    if (!agentId || !prompt || !conversationId) {
      throw new Error("agentId, prompt y conversationId son requeridos.");
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? '',
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ''
    );
    
    const { data: agentData, error: agentError } = await supabaseAdmin
      .from("agents")
      .select("system_prompt, user_id, company_name, status, deleted_at")
      .eq("id", agentId)
      .single();
      
    if (agentError) throw new Error("No se pudo encontrar el agente.");
    if (agentData.status !== 'active' || agentData.deleted_at) {
      throw new Error("Este agente no está activo y no puede recibir mensajes.");
    }
    
    const { user_id: agentOwnerId } = agentData;

    // Check Usage Limits of the Agent's Owner (Bypass for Admins)
    const { data: profileData, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('plan, trial_ends_at, role') // Fetch role
      .eq('id', agentOwnerId)
      .single();

    if (profileError) throw new Error("No se pudo verificar el perfil del propietario del agente.");

    // If the agent owner is not an admin, enforce limits
    if (profileData.role !== 'admin') {
      const TRIAL_MESSAGE_LIMIT = 50;
      const currentMonthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

      if (profileData.plan === 'trial') {
        if (profileData.trial_ends_at && new Date(profileData.trial_ends_at) < new Date()) {
          throw new Error("El período de prueba para este agente ha expirado. El propietario necesita actualizar su plan.");
        }

        const { data: usageData } = await supabaseAdmin
          .from('usage_stats')
          .select('messages_sent')
          .eq('user_id', agentOwnerId)
          .eq('month_start', currentMonthStart)
          .single();
        
        const messagesSent = usageData?.messages_sent || 0;
        if (messagesSent >= TRIAL_MESSAGE_LIMIT) {
          throw new Error(`Límite de mensajes del plan de prueba (${TRIAL_MESSAGE_LIMIT}) alcanzado. El propietario necesita actualizar su plan.`);
        }
      }
    }

    // Proceed with existing logic
    await supabaseAdmin.from("public_conversations").upsert({ id: conversationId, agent_id: agentId, user_id: agentOwnerId });
    await supabaseAdmin.from("public_messages").insert({ conversation_id: conversationId, role: "user", content: prompt });

    const genAI = new GoogleGenerativeAI(apiKey);
    const embeddingModel = genAI.getGenerativeModel({ model: "text-embedding-004" });
    const chatModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

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
            match_threshold: 0.6,
            match_count: 20,
            source_ids: sourceIds
        });
        if (matchError) throw matchError;
        if (chunks && chunks.length > 0) {
            context = chunks.map(c => c.content).join("\n\n---\n\n");
        }
    }

    const formattedHistory = (history || []).map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    }));
    
    const fullHistory = [
      { role: "user", parts: [{ text: `**Instrucciones Base:**\n${systemPrompt}\n\n**Contexto Relevante:**\n${context}` }] },
      { role: "model", parts: [{ text: "Entendido. Estoy listo para ayudar." }] },
      ...formattedHistory,
      { role: "user", parts: [{ text: prompt }] }
    ];

    const result = await chatModel.generateContentStream({ contents: fullHistory });

    // Increment message count for the agent owner (if not admin)
    if (profileData.role !== 'admin') {
      const { error: incrementError } = await supabaseAdmin.rpc('increment_message_count', { p_user_id: agentOwnerId });
      if (incrementError) {
        console.error('Failed to increment message count:', incrementError);
      }
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
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 403, // Forbidden
    });
  }
});