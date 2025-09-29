// @ts-nocheck
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.43.4';

serve(async (req) => {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const userId = url.searchParams.get("state"); // Recuperamos el user_id

    console.log("Received callback with code and state:", { code: !!code, userId });

    if (!code || !userId) {
      throw new Error("Faltan el código de autorización o el state (user ID).");
    }

    const googleClientId = Deno.env.get("GOOGLE_CLIENT_ID");
    const googleClientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
    const appUrl = Deno.env.get("APP_URL");
    
    const supabaseUrl = (Deno.env.get("SUPABASE_URL") ?? '').replace(/\/$/, '');
    const redirectUri = `${supabaseUrl}/functions/v1/google-callback`;

    if (!googleClientId || !googleClientSecret || !appUrl) {
        console.error("Missing environment variables in callback:", { 
            googleClientId: !!googleClientId, 
            googleClientSecret: !!googleClientSecret, 
            appUrl: !!appUrl 
        });
      throw new Error("Faltan variables de entorno de Google o APP_URL.");
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
    console.log("Tokens received from Google:", tokens);
    if (tokens.error) {
      console.error("Error getting tokens from Google:", tokens.error_description);
      throw new Error(`Error al obtener tokens: ${tokens.error_description}`);
    }

    const { access_token, refresh_token, expires_in } = tokens;
    const expires_at = new Date(Date.now() + expires_in * 1000).toISOString();

    // Guardar credenciales en Supabase
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? '',
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ''
    );

    const upsertData = {
      user_id: userId,
      service: "google_calendar",
      access_token,
      expires_at,
      ...(refresh_token && { refresh_token }),
    };

    const { error: upsertError } = await supabaseAdmin
      .from("user_credentials")
      .upsert(upsertData, { onConflict: 'user_id, service' });

    if (upsertError) {
        console.error("Error upserting credentials to Supabase:", upsertError);
      throw upsertError;
    }
    console.log("Credentials successfully saved to Supabase for user:", userId);

    return Response.redirect(`${appUrl}/dashboard?google_auth=success`, 302);

  } catch (error) {
    console.error("Error in google-callback:", error);
    const appUrl = Deno.env.get("APP_URL") || "/";
    return Response.redirect(`${appUrl}/dashboard?google_auth=error&message=${encodeURIComponent(error.message)}`, 302);
  }
});