// @ts-nocheck
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.43.4';
import * as cheerio from "https://esm.sh/cheerio@1.0.0-rc.12";
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "https://esm.sh/@google/generative-ai@0.11.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_PAGES_TO_SCRAPE = 15;

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

async function scrapeWebsite(startUrl) {
  const urlQueue = [startUrl];
  const visitedUrls = new Set();
  let allTextContent = "";
  const baseUrl = new URL(startUrl).origin;

  while (urlQueue.length > 0 && visitedUrls.size < MAX_PAGES_TO_SCRAPE) {
    const currentUrl = urlQueue.shift();

    if (!currentUrl || visitedUrls.has(currentUrl)) {
      continue;
    }

    try {
      console.log(`Scraping: ${currentUrl}`);
      visitedUrls.add(currentUrl);

      const response = await fetch(currentUrl, {
        headers: { 'User-Agent': 'BotBoxxScraper/1.0' }
      });

      if (!response.ok || !response.headers.get("content-type")?.includes("text/html")) {
        console.log(`Skipping ${currentUrl} - Not HTML or not OK`);
        continue;
      }

      const html = await response.text();
      const $ = cheerio.load(html);

      $('script, style, nav, footer, header, aside').remove();

      const pageTitle = $('title').text() || '';
      const mainContent = $('body').text();
      const cleanedText = mainContent.replace(/\s\s+/g, ' ').trim();
      
      if (cleanedText) {
        allTextContent += `--- Contenido de ${currentUrl} (Título: ${pageTitle}) ---\n${cleanedText}\n\n`;
      }

      $('a').each((i, link) => {
        const href = $(link).attr('href');
        if (!href) return;

        let nextUrl;
        try {
          nextUrl = new URL(href, currentUrl).href;
        } catch (e) {
          return;
        }

        if (nextUrl.startsWith(baseUrl) && !visitedUrls.has(nextUrl) && !urlQueue.includes(nextUrl)) {
          if (!nextUrl.match(/\.(pdf|jpg|png|zip|css|js|xml|json)$/i) && !nextUrl.includes('#')) {
            urlQueue.push(nextUrl);
          }
        }
      });
    } catch (error) {
      console.error(`Failed to scrape ${currentUrl}:`, error.message);
    }
  }
  return allTextContent;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { agentId, url } = await req.json();
    if (!agentId || !url) {
      throw new Error("agentId y url son requeridos.");
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error("Falta el encabezado de autorización.");
    }
    
    const token = authHeader.replace('Bearer ', '');
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? '',
      Deno.env.get("SUPABASE_ANON_KEY") ?? '',
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error("Token de usuario inválido.");
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? '',
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ''
    );

    const sourceName = new URL(url).hostname;
    
    const { data: sourceData, error: sourceError } = await supabaseAdmin.from("knowledge_sources").insert({
        user_id: user.id,
        agent_id: agentId,
        name: sourceName,
        type: 'website',
    }).select().single();

    if (sourceError) {
      throw sourceError;
    }

    const responsePromise = new Response(JSON.stringify({ message: "El rastreo del sitio web ha comenzado." }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 202,
    });

    setTimeout(async () => {
      try {
        console.log(`Starting scrape for ${sourceName}`);
        const fullText = await scrapeWebsite(url);
        console.log(`Scraped ${fullText.length} characters from ${sourceName}`);
        
        if (fullText.trim().length > 0) {
          console.log("[scrape-and-embed BG] Processing scraped content...");
          const apiKey = Deno.env.get("GEMINI_API_KEY");
          if (!apiKey) throw new Error("GEMINI_API_KEY no está configurada.");
          
          const genAI = new GoogleGenerativeAI(apiKey);
          const embeddingModel = genAI.getGenerativeModel({ model: "text-embedding-004", safetySettings });

          const chunks = simpleChunkText(fullText);
          console.log(`[scrape-and-embed BG] Content split into ${chunks.length} chunks.`);

          if (chunks.length === 0) {
            console.log("[scrape-and-embed BG] No processable content found after chunking.");
            return;
          }

          const BATCH_SIZE = 100;
          const allEmbeddings = [];

          for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
            const batchChunks = chunks.slice(i, i + BATCH_SIZE);
            const embeddingsResponse = await embeddingModel.batchEmbedContents({
              requests: batchChunks.map(chunk => ({ model: "models/text-embedding-004", content: { parts: [{ text: chunk }] } }))
            });
            allEmbeddings.push(...embeddingsResponse.embeddings);
          }

          if (allEmbeddings.length !== chunks.length) {
            throw new Error(`Embedding mismatch. Chunks: ${chunks.length}, Embeddings: ${allEmbeddings.length}`);
          }

          const newChunksToInsert = chunks.map((chunk, i) => ({
            source_id: sourceData.id,
            content: chunk,
            embedding: allEmbeddings[i].values,
          }));

          const { error } = await supabaseAdmin.from("knowledge_chunks").insert(newChunksToInsert);
          if (error) throw error;

          console.log(`[scrape-and-embed BG] Successfully stored ${chunks.length} chunks for source ${sourceData.id}.`);
        } else {
          console.warn(`No content scraped from ${sourceName}.`);
        }
      } catch (e) {
        console.error("Error in background scraping process:", e);
      }
    }, 0);

    return responsePromise;

  } catch (error) {
    console.error("Error in scrape-and-embed function:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});