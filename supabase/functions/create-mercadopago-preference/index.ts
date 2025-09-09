import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { MercadoPagoConfig, Preference } from 'https://esm.sh/mercadopago@2.0.9';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const APP_URL = "https://fyagqhcjfuhtjoeqshwk.supabase.co";

serve(async (req) => {
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

    const client = new MercadoPagoConfig({ accessToken });
    const preferenceClient = new Preference(client);

    const preferenceData = {
      items: [
        {
          id: "premium-plan",
          title: "BotBoxx - Plan Premium",
          quantity: 1,
          unit_price: 97,
          currency_id: "USD",
        },
      ],
      payer: {
        email: userEmail,
      },
      back_urls: {
        success: `${APP_URL}/billing?status=success`,
        failure: `${APP_URL}/billing?status=failure`,
        pending: `${APP_URL}/billing?status=pending`,
      },
      auto_return: "approved",
      external_reference: userId,
      notification_url: `https://fyagqhcjfuhtjoeqshwk.supabase.co/functions/v1/mercadopago-webhook`,
    };

    const result = await preferenceClient.create({ body: preferenceData });

    return new Response(JSON.stringify({ preferenceId: result.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Error creating MercadoPago preference:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});