// @ts-nocheck
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.43.4';

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

      console.log(`Fetching payment details for ID: ${paymentId}`);
      const paymentResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      const payment = await paymentResponse.json();

      if (!paymentResponse.ok) {
        console.error("Error fetching payment from MercadoPago:", payment);
        throw new Error(`Failed to fetch payment details: ${payment.message || paymentResponse.statusText}`);
      }

      if (payment && payment.status === 'approved' && payment.external_reference) {
        const userId = payment.external_reference;

        const supabaseAdmin = createClient(
          Deno.env.get("SUPABASE_URL") ?? '',
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ''
        );

        const { error } = await supabaseAdmin
          .from('profiles')
          .update({ 
            plan: 'premium', 
            trial_ends_at: null,
            subscribed_at: new Date().toISOString() 
          })
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