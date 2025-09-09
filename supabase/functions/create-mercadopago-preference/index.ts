// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { MercadoPagoConfig, Preference } from 'https://esm.sh/mercadopago@2.0.9';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FRONTEND_URL = "https://botboxx-demov2.vercel.app";

serve(async (req) => {
  console.log("--- Function create-mercadopago-preference invoked ---");
  console.log(`Request method: ${req.method}`);

  if (req.method === "OPTIONS") {
    console.log("Handling OPTIONS request.");
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    console.log("Parsing request body...");
    const body = await req.json();
    console.log("Request body parsed:", body);
    const { userId, plan, userEmail } = body;

    if (!userId || !plan || !userEmail) {
      console.error("Validation failed: Missing parameters.");
      throw new Error("Faltan parámetros: userId, plan, y userEmail son requeridos.");
    }
    console.log(`Parameters received: userId=${userId}, plan=${plan}, userEmail=${userEmail}`);

    console.log("Retrieving MERCADOPAGO_ACCESS_TOKEN from environment variables...");
    const accessToken = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
    if (!accessToken) {
      console.error("MERCADOPAGO_ACCESS_TOKEN is not set.");
      throw new Error("La clave de acceso de MercadoPago no está configurada en los secretos.");
    }
    console.log("MERCADOPAGO_ACCESS_TOKEN retrieved successfully.");

    console.log("Initializing MercadoPago client...");
    const client = new MercadoPagoConfig({ accessToken });
    const preferenceClient = new Preference(client);
    console.log("MercadoPago client initialized.");

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
        success: `${FRONTEND_URL}/billing?status=success`,
        failure: `${FRONTEND_URL}/billing?status=failure`,
        pending: `${FRONTEND_URL}/billing?status=pending`,
      },
      auto_return: "approved",
      external_reference: userId,
      notification_url: `https://fyagqhcjfuhtjoeqshwk.supabase.co/functions/v1/mercadopago-webhook`,
    };
    console.log("Preference data constructed:", JSON.stringify(preferenceData, null, 2));

    console.log("Creating MercadoPago preference...");
    const result = await preferenceClient.create({ body: preferenceData });
    console.log("MercadoPago preference created successfully:", result);

    console.log("--- Function execution successful, sending response. ---");
    return new Response(JSON.stringify({ preferenceId: result.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("--- An error occurred in the function ---");
    console.error("Error message:", error.message);
    console.error("Error stack:", error.stack);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});