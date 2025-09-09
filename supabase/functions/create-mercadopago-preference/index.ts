// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FRONTEND_URL = "https://botboxx-demov2.vercel.app";

serve(async (req) => {
  console.log("--- Function create-mercadopago-preference invoked (v2) ---");
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { userId, plan, userEmail } = await req.json();
    if (!userId || !plan || !userEmail) {
      throw new Error("Faltan parámetros: userId, plan, y userEmail son requeridos.");
    }

    const accessToken = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
    if (!accessToken) {
      throw new Error("La clave de acceso de MercadoPago no está configurada en los secretos.");
    }

    const preferenceData = {
      items: [
        {
          id: `premium-plan-${userId}`,
          title: "BotBoxx - Plan Premium",
          description: "Suscripción mensual al plan premium de BotBoxx",
          category_id: "services",
          quantity: 1,
          unit_price: 97,
          currency_id: "USD",
        },
      ],
      payer: { email: userEmail },
      back_urls: {
        success: `${FRONTEND_URL}/billing?status=success`,
        failure: `${FRONTEND_URL}/billing?status=failure`,
        pending: `${FRONTEND_URL}/billing?status=pending`,
      },
      auto_return: "approved",
      external_reference: userId,
      notification_url: `https://fyagqhcjfuhtjoeqshwk.supabase.co/functions/v1/mercadopago-webhook`,
    };

    console.log("Creating MercadoPago preference via direct API call...");
    const response = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        'X-Idempotency-Key': `${userId}-${Date.now()}`
      },
      body: JSON.stringify(preferenceData)
    });

    const result = await response.json();

    if (!response.ok) {
      console.error("MercadoPago API error:", result);
      throw new Error(`Error from MercadoPago API: ${result.message || response.statusText}`);
    }

    if (!result || !result.id) {
      console.error("Invalid response from MercadoPago:", result);
      throw new Error("MercadoPago devolvió una respuesta inválida.");
    }

    console.log("MercadoPago preference created successfully:", result.id);
    return new Response(JSON.stringify({ 
      preferenceId: result.id,
      initPoint: result.init_point,
      sandboxInitPoint: result.sandbox_init_point
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
    
  } catch (error) {
    console.error("--- An error occurred in the function ---", error);
    return new Response(JSON.stringify({ 
      error: "Error al crear la preferencia de pago.",
      details: error.message
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});