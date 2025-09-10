// @ts-nocheck
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

// --- Nueva Función de Fragmentación Inteligente ---
function chunkText(text, chunkSize = 1500, chunkOverlap = 200) {
  if (!text) return [];

  // 1. Dividir el texto en bloques lógicos (párrafos, secciones) usando dobles saltos de línea.
  const blocks = text.split(/\n\s*\n/).filter(block => block.trim().length > 0);
  const finalChunks = [];

  for (const block of blocks) {
    // 2. Si un bloque es más pequeño que el tamaño del fragmento, se considera un fragmento completo.
    if (block.length <= chunkSize) {
      finalChunks.push(block);
    } else {
      // 3. Si un bloque es demasiado grande, se divide por el método de ventana deslizante.
      console.log(`Bloque grande detectado (${block.length} caracteres). Aplicando división por tamaño.`);
      let i = 0;
      while (i < block.length) {
        const end = Math.min(i + chunkSize, block.length);
        finalChunks.push(block.slice(i, end));
        i += chunkSize - chunkOverlap;
        if (i + chunkOverlap >= block.length && i < block.length) {
          finalChunks.push(block.slice(i));
          break;
        }
      }
    }
  }

  return finalChunks.filter(chunk => chunk.trim().length > 10); // Filtra fragmentos muy pequeños
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

    // 1. Dividir el texto en fragmentos usando la nueva lógica inteligente
    const chunks = chunkText(textContent);

    if (chunks.length === 0) {
      return new Response(JSON.stringify({ message: "No se encontró contenido procesable para guardar." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // 2. Generar embeddings para cada fragmento en lotes para no exceder el límite de la API
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