// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function recursiveChunkText(text, chunkSize = 1000, chunkOverlap = 150, separators = ["\n\n", "\n", ". ", " ", ""]) {
  if (text.length <= chunkSize) {
    return [text];
  }

  const currentSeparator = separators[0];
  const nextSeparators = separators.slice(1);

  let chunks = [];
  if (currentSeparator) {
    const splits = text.split(currentSeparator);
    let buffer = "";
    for (const split of splits) {
      const newBuffer = buffer + (buffer ? currentSeparator : "") + split;
      if (newBuffer.length > chunkSize) {
        if (buffer) {
          const subChunks = await recursiveChunkText(buffer, chunkSize, chunkOverlap, nextSeparators);
          chunks.push(...subChunks);
        }
        buffer = split;
      } else {
        buffer = newBuffer;
      }
    }
    if (buffer) {
      const subChunks = await recursiveChunkText(buffer, chunkSize, chunkOverlap, nextSeparators);
      chunks.push(...subChunks);
    }
  } else {
    for (let i = 0; i < text.length; i += chunkSize - chunkOverlap) {
      chunks.push(text.slice(i, i + chunkSize));
    }
  }

  const mergedChunks = [];
  let currentChunk = "";
  for (const chunk of chunks) {
    if ((currentChunk + chunk).length <= chunkSize) {
      currentChunk += chunk;
    } else {
      mergedChunks.push(currentChunk);
      currentChunk = chunk;
    }
  }
  if (currentChunk) {
    mergedChunks.push(currentChunk);
  }

  return mergedChunks.filter(chunk => chunk.trim().length > 10);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { sourceId, textContent } = await req.json();
    const openRouterApiKey = Deno.env.get("OPENROUTER_API_KEY");

    if (!openRouterApiKey) throw new Error("OPENROUTER_API_KEY no está configurada.");
    if (!sourceId || !textContent) throw new Error("sourceId y textContent son requeridos.");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? '',
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ''
    );

    // 1. Dividir el texto en fragmentos
    const chunks = await recursiveChunkText(textContent);

    if (chunks.length === 0) {
      return new Response(JSON.stringify({ message: "No se encontró contenido procesable para guardar." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // 2. Generar embeddings para cada fragmento usando OpenRouter
    const BATCH_SIZE = 100;
    const allEmbeddings = [];

    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batchChunks = chunks.slice(i, i + BATCH_SIZE);
      
      const embeddingsResponse = await fetch("https://openrouter.ai/api/v1/embeddings", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${openRouterApiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          "model": "openai/text-embedding-ada-002", // Este modelo produce 1536 dimensiones
          "input": batchChunks
        })
      });

      if (!embeddingsResponse.ok) {
        const errorBody = await embeddingsResponse.text();
        throw new Error(`Error from OpenRouter API: ${errorBody}`);
      }

      const { data } = await embeddingsResponse.json();
      allEmbeddings.push(...data.map(item => item.embedding));
    }

    const newChunks = chunks.map((chunk, i) => ({
      source_id: sourceId,
      content: chunk,
      embedding: allEmbeddings[i],
    }));

    // 3. Guardar los fragmentos y sus embeddings en la base de datos
    const { error } = await supabaseAdmin.from("knowledge_chunks").insert(newChunks);
    if (error) throw error;

    return new Response(JSON.stringify({ message: `${chunks.length} fragmentos de conocimiento guardados con embeddings de 1536 dimensiones.` }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Error in embed-and-store function:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});