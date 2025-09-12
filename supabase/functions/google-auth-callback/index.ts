// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const userId = url.searchParams.get("state");

    if (!code || !userId) {
      throw new Error("Faltan el código de autorización o el state (user ID).");
    }

    const googleClientId = Deno.env.get("GOOGLE_CLIENT_ID");
    const googleClientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
    const siteUrl = Deno.env.get("SITE_URL");
    const redirectUri = `${Deno.env.get("SUPABASE_URL")}/functions/v1/google-auth-callback`;

    if (!googleClientId || !googleClientSecret || !siteUrl) {
      throw new Error("Faltan variables de entorno de Google.");
    }

    // Intercambiar código por tokens
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code,
        client_id: googleClientId,
        client_secret: googleClientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    const tokens = await tokenResponse.json();
    if (tokens.error) {
      throw new Error(`Error al obtener tokens: ${tokens.error_description}`);
    }

    const { access_token, refresh_token, expires_in } = tokens;
    const expires_at = new Date(Date.now() + expires_in * 1000).toISOString();

    // Guardar credenciales en Supabase
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? '',
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ''
    );

    const { error: upsertError } = await supabaseAdmin
      .from("user_credentials")
      .upsert({
        user_id: userId,
        service: "google_calendar",
        access_token,
        refresh_token,
        expires_at,
      }, { onConflict: 'user_id, service' });

    if (upsertError) {
      throw upsertError;
    }

    // Redirigir de vuelta a la aplicación
    return Response.redirect(`${siteUrl}/dashboard?google_auth=success`, 302);

  } catch (error) {
    console.error("Error in google-auth-callback:", error);
    const siteUrl = Deno.env.get("SITE_URL") || "/";
    return Response.redirect(`${siteUrl}/dashboard?google_auth=error&message=${encodeURIComponent(error.message)}`, 302);
  }
});