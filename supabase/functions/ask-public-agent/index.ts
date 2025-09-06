// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { agentId, prompt, history } = await req.json();
    const apiKey = Deno.env.get("GEMINI_API_KEY");

    if (!apiKey) {
      throw new Error("GEMINI_API_KEY no está configurada.");
    }
    if (!agentId || !prompt) {
      throw new Error("agentId y prompt son requeridos.");
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? '',
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ''
    );

    // 1. Fetch agent's system prompt
    const { data: agentData, error: agentError } = await supabaseAdmin
      .from("agents")
      .select("system_prompt")
      .eq("id", agentId)
      .single();

    if (agentError) throw new Error("No se pudo encontrar el agente.");
    const systemPrompt = agentData.system_prompt || "Eres un asistente de IA servicial.";

    // 2. Fetch and combine knowledge sources
    const { data: sources, error: sourcesError } = await supabaseAdmin
      .from("knowledge_sources")
      .select("name, content")
      .eq("agent_id", agentId);

    if (sourcesError) throw new Error("Error al obtener el conocimiento del agente.");
    const context = sources.map(s => `--- Contexto de ${s.name} ---\n${s.content}`).join("\n\n");

    // 3. Call Gemini API
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const formattedHistory = (history || []).map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    }));

    const chat = model.startChat({
      history: [
        {
          role: "user",
          parts: [{ text: `**Instrucciones Base:**\n${systemPrompt}\n\n**Contexto del Negocio:**\n${context}` }],
        },
        {
          role: "model",
          parts: [{ text: "Entendido. Estoy listo para ayudar siguiendo estas instrucciones y usando el contexto proporcionado." }],
        },
        ...formattedHistory,
      ],
    });

    const result = await chat.sendMessage(prompt);
    const response = await result.response;
    const text = response.text();

    return new Response(JSON.stringify({ response: text }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Error in ask-public-agent function:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});