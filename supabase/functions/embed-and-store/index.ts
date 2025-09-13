// @ts-nocheck
import { serve } from "std/http/server.ts";
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";

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

// --- Nueva Función de Fragmentación Recursiva ---
// Esta función divide el texto de manera más inteligente, intentando mantener la cohesión del contenido.
async function recursiveChunkText(text, chunkSize = 1000, chunkOverlap = 150, separators = ["\n\n", "\n", ". ", " ", ""]) {
  if (text.length <= chunkSize) {
    return [text];
  }

  // Intenta dividir con el primer separador de la lista.
  const currentSeparator = separators[0];
  const nextSeparators = separators.slice(1);

  let chunks = [];
  if (currentSeparator) {
    const splits = text.split(currentSeparator);
    let buffer = "";
    for (const split of splits) {
      const newBuffer = buffer + (buffer ? currentSeparator : "") + split;
      if (newBuffer.length > chunkSize) {
        // Si el buffer excede el tamaño, lo agregamos como un chunk
        // y si es muy grande, lo subdividimos recursivamente.
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
    // Si no hay más separadores, cortamos por tamaño.
    for (let i = 0; i < text.length; i += chunkSize - chunkOverlap) {
      chunks.push(text.slice(i, i + chunkSize));
    }
  }

  // Unir chunks pequeños para optimizar
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
    const apiKey = Deno.env.get("GEMINI_API_KEY");

    if (!apiKey) throw new Error("GEMINI_API_KEY no está configurada.");
    if (!sourceId || !textContent) throw new Error("sourceId y textContent son requeridos.");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? '',
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ''
    );
    const genAI = new GoogleGenerativeAI(apiKey);
    const embeddingModel = genAI.getGenerativeModel({ model: "text-embedding-004", safetySettings });

    // 1. Dividir el texto en fragmentos usando la nueva lógica recursiva
    const chunks = await recursiveChunkText(textContent);

    if (chunks.length === 0) {
      return new Response(JSON.stringify({ message: "No se encontró contenido procesable para guardar." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // 2. Generar embeddings para cada fragmento en lotes
    const BATCH_SIZE = 100;
    const allEmbeddings = [];

    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batchChunks = chunks.slice(i, i + BATCH_SIZE);
      const embeddingsResponse = await embeddingModel.batchEmbedContents({
        requests: batchChunks.map(chunk => ({ model: "models/text-embedding-004", content: { parts: [{ text: chunk }] } }))
      });
      allEmbeddings.push(...embeddingsResponse.embeddings);
    }

    const newChunks = chunks.map((chunk, i) => ({
      source_id: sourceId,
      content: chunk,
      embedding: allEmbeddings[i].values,
    }));

    // 3. Guardar los fragmentos y sus embeddings en la base de datos
    const { error } = await supabaseAdmin.from("knowledge_chunks").insert(newChunks);
    if (error) throw error;

    return new Response(JSON.stringify({ message: `${chunks.length} fragmentos de conocimiento guardados.` }), {
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