// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { DOMParser } from "https://deno.land/x/deno_dom/deno-dom-wasm.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_PAGES_TO_SCRAPE = 15;

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
        continue;
      }

      const html = await response.text();
      const doc = new DOMParser().parseFromString(html, "text/html");
      if (!doc) continue;

      const pageTitle = doc.querySelector('title')?.textContent || '';
      const mainContent = doc.body?.innerText || '';
      
      allTextContent += `--- Contenido de ${currentUrl} (Título: ${pageTitle}) ---\n${mainContent}\n\n`;

      const links = doc.querySelectorAll('a');
      for (const link of links) {
        const href = link.getAttribute('href');
        if (!href) continue;

        let nextUrl;
        try {
          nextUrl = new URL(href, currentUrl).href;
        } catch (e) {
          continue;
        }

        if (nextUrl.startsWith(baseUrl) && !visitedUrls.has(nextUrl) && !urlQueue.includes(nextUrl)) {
          // Evitar enlaces a archivos y anclas
          if (!nextUrl.match(/\.(pdf|jpg|png|zip|css|js)$/i) && !nextUrl.includes('#')) {
            urlQueue.push(nextUrl);
          }
        }
      }
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
    if (!agentId || !url) throw new Error("agentId y url son requeridos.");

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

    if (sourceError) throw sourceError;

    // Responder inmediatamente para no causar timeout en el cliente
    setTimeout(async () => {
      try {
        const fullText = await scrapeWebsite(url);
        if (fullText.trim().length > 0) {
          await supabaseAdmin.functions.invoke("embed-and-store", {
            body: { sourceId: sourceData.id, textContent: fullText },
          });
          console.log(`Scraping and embedding for ${sourceName} completed.`);
        } else {
          console.warn(`No content scraped from ${sourceName}.`);
        }
      } catch (e) {
        console.error("Error in background scraping process:", e);
      }
    }, 0);

    return new Response(JSON.stringify({ message: "El rastreo del sitio web ha comenzado." }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 202, // Accepted
    });

  } catch (error) {
    console.error("Error in scrape-and-embed function:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});