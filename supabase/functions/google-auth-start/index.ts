// @ts-nocheck
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.43.4';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
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

    const googleClientId = Deno.env.get("GOOGLE_CLIENT_ID");
    const appUrl = Deno.env.get("APP_URL");

    if (!googleClientId || !appUrl) {
      console.error("Missing environment variables:", { googleClientId: !!googleClientId, appUrl: !!appUrl });
      throw new Error("Las variables de entorno GOOGLE_CLIENT_ID y APP_URL son requeridas.");
    }

    const redirectUri = `${Deno.env.get("SUPABASE_URL")}/functions/v1/google-auth-callback`;
    
    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authUrl.searchParams.set("client_id", googleClientId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("response_type", "code");
    // Usamos un scope más estándar y simple. El encoding se maneja automáticamente por URLSearchParams.
    authUrl.searchParams.set("scope", "https://www.googleapis.com/auth/calendar.readonly");
    authUrl.searchParams.set("access_type", "offline"); // Muy importante para obtener el refresh_token
    authUrl.searchParams.set("prompt", "consent");     // Muy importante para forzar que nos den el refresh_token
    authUrl.searchParams.set("state", user.id); // Pasamos el user_id en el state para recuperarlo en el callback

    console.log("Generated Google Auth URL:", authUrl.toString());
    
    return new Response(JSON.stringify({ authUrl: authUrl.toString() }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    console.error("Error in google-auth-start:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});