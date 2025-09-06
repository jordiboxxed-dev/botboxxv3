// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { city } = await req.json();
    if (!city) {
      throw new Error("El parámetro 'city' es requerido.");
    }

    // Mock data for weather forecast
    const weatherData = {
      "madrid": { temperature: "25°C", forecast: "Soleado con algunas nubes" },
      "barcelona": { temperature: "28°C", forecast: "Mayormente soleado" },
      "sevilla": { temperature: "35°C", forecast: "Despejado y caluroso" },
    };

    const cityLower = city.toLowerCase();
    const forecast = weatherData[cityLower] || { temperature: "22°C", forecast: "Parcialmente nublado" };

    return new Response(JSON.stringify(forecast), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});