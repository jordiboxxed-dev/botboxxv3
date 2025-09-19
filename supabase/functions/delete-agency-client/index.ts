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

    // 3. Verify that the caller is a valid agency owner and that the client belongs to their agency
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
      throw new Error("El usuario no es un dueño de agencia válido.");
    }

    const { data: clientProfile, error: clientProfileError } = await supabaseAdmin
      .from('profiles')
      .select('agency_id')
      .eq('id', clientId)
      .single();

    if (clientProfileError || !clientProfile) {
        throw new Error("Cliente no encontrado.");
    }

    if (clientProfile.agency_id !== ownerProfile.agency_id) {
        throw new Error("No tienes permiso para eliminar este cliente.");
    }

    // 4. Delete the client user from auth.users
    // This will cascade and delete the profile and other related data.
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(clientId);

    if (deleteError) {
      throw deleteError;
    }

    // 5. Send success response
    return new Response(JSON.stringify({ message: "Cliente eliminado exitosamente." }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    console.error("Error in delete-agency-client:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});