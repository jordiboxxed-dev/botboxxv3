// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { GoogleGenerativeAI, FunctionDeclarationSchemaType } from "https://esm.sh/@google/generative-ai";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Helper function to convert DB parameters to Gemini tool format
const formatToolsForGemini = (dbTools) => {
  if (!dbTools || dbTools.length === 0) return null;
  return dbTools.map(tool => ({
    functionDeclarations: [{
      name: tool.name,
      description: tool.description,
      parameters: {
        type: FunctionDeclarationSchemaType.OBJECT,
        properties: tool.parameters.properties || {},
        required: tool.parameters.required || [],
      },
    }]
  }));
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
        match_threshold: 0.7,
        match_count: 5,
        source_ids: sourceIds
      });
      if (matchError) throw matchError;
      if (chunks && chunks.length > 0) {
        context = chunks.map(c => c.content).join("\n\n---\n\n");
      }
    }

    // 2. Fetch available tools for the agent
    const { data: agentTools, error: toolsError } = await supabaseAdmin
      .from("agent_tools")
      .select("name, description, parameters, endpoint_url")
      .eq("agent_id", agentId);
    if (toolsError) throw toolsError;

    const formattedTools = formatToolsForGemini(agentTools);

    const chat = generativeModel.startChat({
        history: [
            { role: "user", parts: [{ text: `**Instrucciones Base:**\n${systemPrompt}\n\n**Contexto Relevante de la Base de Conocimiento:**\n${context}` }] },
            { role: "model", parts: [{ text: "Entendido. Estoy listo para ayudar usando solo la información y las instrucciones proporcionadas." }] },
            ...(history || []).map(msg => ({
                role: msg.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: msg.content }]
            }))
        ],
        tools: formattedTools
    });

    // 3. First call to Gemini
    const result = await chat.sendMessageStream(prompt);

    // 4. Process the response stream
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        
        for await (const chunk of result.stream) {
          const functionCalls = chunk.functionCalls();
          
          if (functionCalls && functionCalls.length > 0) {
            // 5. Handle function call
            const call = functionCalls[0];
            const toolToExecute = agentTools.find(t => t.name === call.name);

            if (toolToExecute) {
              try {
                // 6. Execute the tool by calling its endpoint
                const toolResponse = await fetch(toolToExecute.endpoint_url, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(call.args),
                });

                if (!toolResponse.ok) {
                  const errorBody = await toolResponse.text();
                  throw new Error(`Error en la herramienta (${toolResponse.status}): ${errorBody}`);
                }
                const toolResult = await toolResponse.json();

                // 7. Send tool result back to Gemini
                const result2 = await chat.sendMessageStream([
                  {
                    functionResponse: {
                      name: call.name,
                      response: toolResult,
                    },
                  },
                ]);

                // 8. Stream the final natural language response
                for await (const chunk2 of result2.stream) {
                    const text = chunk2.text();
                    if (text) {
                        controller.enqueue(encoder.encode(text));
                    }
                }

              } catch (e) {
                const errorMessage = `Error al ejecutar la herramienta ${call.name}: ${e.message}`;
                controller.enqueue(encoder.encode(errorMessage));
              }
            } else {
              const errorMessage = `La IA intentó llamar a una herramienta no definida: ${call.name}`;
              controller.enqueue(encoder.encode(errorMessage));
            }
          } else {
            // It's a direct text response
            const text = chunk.text();
            if (text) {
              controller.enqueue(encoder.encode(text));
            }
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