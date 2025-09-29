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

    // 4. Generate a magic link for the client to get a verification token
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
        type: 'magiclink',
        email: clientProfile.email,
    });

    if (linkError) throw linkError;

    const actionLink = linkData.properties.action_link;
    const url = new URL(actionLink);
    const magicLinkToken = url.searchParams.get('token');

    if (!magicLinkToken) {
        throw new Error("No se pudo extraer el token del enlace mágico generado.");
    }

    // 5. Verify the token using a temporary anon client to get a session for the client user
    const tempSupabaseClient = createClient(
        Deno.env.get("SUPABASE_URL") ?? '',
        Deno.env.get("SUPABASE_ANON_KEY") ?? ''
    );

    const { data: verifyData, error: verifyError } = await tempSupabaseClient.auth.verifyOtp({
        token: magicLinkToken,
        type: 'magiclink',
        email: clientProfile.email,
    });

    if (verifyError) {
        throw new Error(`Error al verificar el token de impersonación: ${verifyError.message}`);
    }

    if (!verifyData || !verifyData.session) {
        throw new Error("La verificación del token no devolvió una sesión válida.");
    }

    const { access_token, refresh_token } = verifyData.session;

    // 6. Return the tokens to the agency owner's client
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