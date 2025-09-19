// @ts-nocheck
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.43.4';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "https://esm.sh/@google/generative-ai@0.11.3";

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

function simpleChunkText(text, chunkSize = 756, chunkOverlap = 100) {
  const chunks = [];
  if (!text || typeof text !== 'string') return chunks;

  let i = 0;
  while (i < text.length) {
    const end = Math.min(i + chunkSize, text.length);
    chunks.push(text.slice(i, end));
    i += chunkSize - chunkOverlap;
  }
  return chunks.filter(chunk => chunk.trim().length > 0);
}

const processInBackground = async (sourceId, textContent) => {
  try {
    console.log(`[embed-and-store BG] Iniciando proceso para sourceId: ${sourceId}`);
    
    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) throw new Error("GEMINI_API_KEY no está configurada.");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? '',
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ''
    );
    
    const genAI = new GoogleGenerativeAI(apiKey);
    const embeddingModel = genAI.getGenerativeModel({ model: "text-embedding-004", safetySettings });

    console.log("[embed-and-store BG] 1. Fragmentando texto...");
    const chunks = simpleChunkText(textContent);
    console.log(`[embed-and-store BG] Texto fragmentado en ${chunks.length} partes.`);

    if (chunks.length === 0) {
      console.log("[embed-and-store BG] No se encontró contenido procesable.");
      return;
    }

    console.log("[embed-and-store BG] 2. Generando embeddings...");
    const BATCH_SIZE = 100;
    const allEmbeddings = [];

    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batchChunks = chunks.slice(i, i + BATCH_SIZE);
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(chunks.length / BATCH_SIZE);
      console.log(`[embed-and-store BG] Procesando lote ${batchNumber}/${totalBatches}...`);
      
      const embeddingsResponse = await embeddingModel.batchEmbedContents({
        requests: batchChunks.map(chunk => ({ 
          model: "models/text-embedding-004", 
          content: { parts: [{ text: chunk }] } 
        }))
      });
      allEmbeddings.push(...embeddingsResponse.embeddings);
    }
    console.log(`[embed-and-store BG] Se generaron ${allEmbeddings.length} embeddings.`);

    if (allEmbeddings.length !== chunks.length) {
      throw new Error(`Inconsistencia en la generación de embeddings. Chunks: ${chunks.length}, Embeddings: ${allEmbeddings.length}`);
    }

    const newChunksToInsert = chunks.map((chunk, i) => ({
      source_id: sourceId,
      content: chunk,
      embedding: allEmbeddings[i].values,
    }));

    console.log("[embed-and-store BG] 3. Guardando fragmentos en la base de datos...");
    const { error } = await supabaseAdmin.from("knowledge_chunks").insert(newChunksToInsert);
    if (error) {
      console.error("[embed-and-store BG] Error en la inserción a la base de datos:", error);
      throw error;
    }

    console.log(`[embed-and-store BG] Proceso completado. Se guardaron ${chunks.length} fragmentos.`);
  } catch (error) {
    console.error("[embed-and-store BG] Error fatal en el proceso de fondo:", error);
  }
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { sourceId, textContent } = await req.json();
    if (!sourceId || !textContent) {
      return new Response(JSON.stringify({ error: "sourceId y textContent son requeridos." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // No esperar a que termine, se ejecuta en segundo plano
    setTimeout(() => processInBackground(sourceId, textContent), 0);

    // Responder inmediatamente al cliente
    const successMessage = `El procesamiento del conocimiento ha comenzado. Se añadirá en segundo plano.`;
    return new Response(JSON.stringify({ message: successMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 202, // Accepted
    });
  } catch (error) {
    console.error("[embed-and-store] Error al iniciar la función:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});