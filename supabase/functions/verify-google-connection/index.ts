// @ts-nocheck
import { serve } from "std/http/server.ts";
import { createClient } from '@supabase/supabase-js';

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
    // 1. Authenticate user with Supabase
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

    // 2. Get user's Google credentials
    const { data: creds, error: credsError } = await supabaseAdmin
      .from("user_credentials")
      .select("refresh_token")
      .eq("user_id", user.id)
      .eq("service", "google_calendar")
      .single();

    if (credsError || !creds || !creds.refresh_token) {
      // No credentials or no refresh token, so not connected.
      return new Response(JSON.stringify({ isConnected: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // 3. Try to refresh the token to verify the connection is still valid
    const googleClientId = Deno.env.get("GOOGLE_CLIENT_ID");
    const googleClientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");

    const refreshResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: googleClientId,
        client_secret: googleClientSecret,
        refresh_token: creds.refresh_token,
        grant_type: "refresh_token",
      }),
    });

    const newTokens = await refreshResponse.json();

    // 4. Handle response from Google
    if (newTokens.error) {
      console.warn(`Google connection verification failed for user ${user.id}:`, newTokens.error_description);
      // If the grant is invalid, it means the user revoked access. Clean up the credentials.
      if (newTokens.error === 'invalid_grant') {
        await supabaseAdmin
          .from("user_credentials")
          .delete()
          .eq("user_id", user.id)
          .eq("service", "google_calendar");
        console.log(`Cleaned up invalid credentials for user ${user.id}.`);
      }
      return new Response(JSON.stringify({ isConnected: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // If we successfully got a new access token, the connection is valid.
    // We don't need to save the new token here, the main tool function will do that when it's used.
    return new Response(JSON.stringify({ isConnected: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    console.error("Error in verify-google-connection:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});