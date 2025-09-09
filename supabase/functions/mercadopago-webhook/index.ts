import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { MercadoPagoConfig, Payment } from 'https://esm.sh/mercadopago@2.0.9';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const notification = await req.json();

    if (notification.type === 'payment' && notification.data?.id) {
      const paymentId = notification.data.id;

      const accessToken = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
      if (!accessToken) throw new Error("MercadoPago access token not configured.");

      const client = new MercadoPagoConfig({ accessToken });
      const paymentClient = new Payment(client);

      const payment = await paymentClient.get({ id: paymentId });

      if (payment && payment.status === 'approved' && payment.external_reference) {
        const userId = payment.external_reference;

        const supabaseAdmin = createClient(
          Deno.env.get("SUPABASE_URL") ?? '',
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ''
        );

        const { error } = await supabaseAdmin
          .from('profiles')
          .update({ plan: 'premium', trial_ends_at: null })
          .eq('id', userId);

        if (error) {
          console.error(`Error updating profile for user ${userId}:`, error);
          throw new Error(`Failed to update user profile after payment: ${error.message}`);
        }

        console.log(`Successfully upgraded user ${userId} to premium plan.`);
      }
    }

    return new Response(JSON.stringify({ status: "ok" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Error in MercadoPago webhook:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});