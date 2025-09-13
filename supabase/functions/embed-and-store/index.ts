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

// --- Función de Fragmentación de Texto Sencilla y Robusta ---
// Divide el texto en fragmentos de un tamaño determinado con superposición.
function simpleChunkText(text, chunkSize = 1000, chunkOverlap = 150) {
  const chunks = [];
  if (!text || typeof text !== 'string') return chunks;

  let i = 0;
  while (i < text.length) {
    const end = Math.min(i + chunkSize, text.length);
    chunks.push(text.slice(i, end));
    i += chunkSize - chunkOverlap;
  }
  return chunks.filter(chunk => chunk.trim().length > 10); // Filtrar chunks vacíos o muy cortos
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

    // 1. Dividir el texto en fragmentos usando el método simple
    const chunks = simpleChunkText(textContent);

    if (chunks.length === 0) {
      return new Response(JSON.stringify({ message: "No se encontró contenido procesable para guardar." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // 2. Generar embeddings para cada fragmento en lotes
    const BATCH_SIZE = 100; // Límite de Gemini para batchEmbedContents
    const allEmbeddings = [];

    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batchChunks = chunks.slice(i, i + BATCH_SIZE);
      const embeddingsResponse = await embeddingModel.batchEmbedContents({
        requests: batchChunks.map(chunk => ({ model: "models/text-embedding-004", content: { parts: [{ text: chunk }] } }))
      });
      allEmbeddings.push(...embeddingsResponse.embeddings);
    }

    // Verificar que tengamos un embedding por cada chunk
    if (allEmbeddings.length !== chunks.length) {
      throw new Error(`Inconsistencia en la generación de embeddings. Chunks: ${chunks.length}, Embeddings: ${allEmbeddings.length}`);
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