// @ts-nocheck
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.43.4';

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
    // 1. Authenticate the caller (agency owner)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error("Falta el encabezado de autorización.");
    const token = authHeader.replace('Bearer ', '');
    
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? '',
      Deno.env.get("SUPABASE_ANON_KEY") ?? '',
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );
    const { data: { user: agencyOwner }, error: userError } = await supabase.auth.getUser();
    if (userError || !agencyOwner) throw new Error("Token de usuario inválido.");

    // 2. Get clientId from request body
    const { clientId } = await req.json();
    if (!clientId) {
      throw new Error("clientId es requerido.");
    }

    // 3. Verify permissions using admin client
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? '',
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ''
    );
    
    const { data: ownerProfile, error: ownerProfileError } = await supabaseAdmin
      .from('profiles')
      .select('agency_id, role')
      .eq('id', agencyOwner.id)
      .single();
    
    if (ownerProfileError || !ownerProfile || ownerProfile.role !== 'agency_owner' || !ownerProfile.agency_id) {
      throw new Error("No tienes permisos de agencia para realizar esta acción.");
    }

    const { data: clientProfile, error: clientProfileError } = await supabaseAdmin
      .from('profiles')
      .select('agency_id, email')
      .eq('id', clientId)
      .single();

    if (clientProfileError || !clientProfile) {
        throw new Error("Cliente no encontrado.");
    }

    if (clientProfile.agency_id !== ownerProfile.agency_id) {
        throw new Error("Este cliente no pertenece a tu agencia.");
    }

    // 4. Generate a magic link for the client
    const appUrl = Deno.env.get("APP_URL");
    if (!appUrl) throw new Error("La variable de entorno APP_URL no está configurada.");

    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
        type: 'magiclink',
        email: clientProfile.email,
        options: {
            redirectTo: `${appUrl}/auth/callback` // A valid redirect URL is required
        }
    });

    if (linkError) throw linkError;

    const actionLink = linkData.properties.action_link;

    // 5. "Visit" the link server-side to get the redirect URL which contains the tokens
    const verifyResponse = await fetch(actionLink, { redirect: 'manual' });

    // We expect a 302 redirect. Deno's fetch doesn't follow redirects by default.
    if (verifyResponse.status < 300 || verifyResponse.status >= 400) {
        const errorBody = await verifyResponse.text();
        throw new Error(`Fallo al verificar el enlace mágico. Estado: ${verifyResponse.status}. Cuerpo: ${errorBody}`);
    }

    const location = verifyResponse.headers.get('Location');
    if (!location) {
        throw new Error("La redirección de verificación no proporcionó una cabecera de ubicación.");
    }

    // 6. Parse the tokens from the URL fragment (#)
    const url = new URL(location);
    const params = new URLSearchParams(url.hash.substring(1)); // remove '#' at the beginning

    const access_token = params.get('access_token');
    const refresh_token = params.get('refresh_token');

    if (!access_token || !refresh_token) {
        throw new Error("No se pudieron extraer los tokens de la redirección de verificación.");
    }

    // 7. Return the tokens to the client
    return new Response(JSON.stringify({ access_token, refresh_token }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    console.error("Error in impersonate-client:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});