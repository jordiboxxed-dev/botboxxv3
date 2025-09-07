// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Buffer } from "https://deno.land/std@0.190.0/node/buffer.ts";
import pdf from "https://esm.sh/pdf-parse@1.1.1";
import mammoth from "https://esm.sh/mammoth@1.10.0";

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
    const contentType = req.headers.get("content-type") || "";
    if (!contentType) {
      throw new Error("El encabezado Content-Type es requerido.");
    }

    const arrayBuffer = await req.arrayBuffer();
    if (arrayBuffer.byteLength === 0) {
      throw new Error("El archivo está vacío o no se pudo leer.");
    }

    let text = "";
    const buffer = Buffer.from(arrayBuffer);

    if (contentType.includes("application/pdf")) {
      const data = await pdf(buffer);
      text = data.text;
    } else if (contentType.includes("application/vnd.openxmlformats-officedocument.wordprocessingml.document")) {
      const result = await mammoth.extractRawText({ buffer });
      text = result.value;
    } else if (contentType.startsWith("text/")) {
      const decoder = new TextDecoder("utf-8");
      text = decoder.decode(arrayBuffer);
    } else {
      // Fallback for generic mime types like application/octet-stream, often used for .txt files
      try {
        const decoder = new TextDecoder("utf-8");
        text = decoder.decode(arrayBuffer);
      } catch (e) {
        throw new Error(`Tipo de archivo no soportado: ${contentType}. Por favor, sube un PDF, DOCX o TXT.`);
      }
    }

    if (!text || text.trim().length === 0) {
        throw new Error("No se pudo extraer texto del archivo. Puede que esté vacío, corrupto o sea una imagen.");
    }

    const cleanedText = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();

    return new Response(JSON.stringify({ content: cleanedText }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Error in extract-text-from-file function:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});