// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import pdf from "https://esm.sh/pdf-parse@1.1.1";
import mammoth from "https://esm.sh/mammoth@1.7.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const contentType = req.headers.get("content-type");
    if (!contentType) {
      throw new Error("El encabezado Content-Type es requerido.");
    }
    
    const fileBuffer = await req.arrayBuffer();

    let text = "";

    if (contentType.includes("application/pdf")) {
      const data = await pdf(fileBuffer);
      text = data.text;
    } else if (contentType.includes("application/vnd.openxmlformats-officedocument.wordprocessingml.document")) {
      const result = await mammoth.extractRawText({ arrayBuffer: fileBuffer });
      text = result.value;
    } else if (contentType.includes("text/plain")) {
      text = new TextDecoder().decode(fileBuffer);
    } else {
      throw new Error("Tipo de archivo no soportado. Por favor, sube un PDF, DOCX o TXT.");
    }

    if (!text) {
        throw new Error("No se pudo extraer texto del archivo. Puede que esté vacío o corrupto.");
    }

    return new Response(JSON.stringify({ content: text.trim() }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Error extracting text:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});