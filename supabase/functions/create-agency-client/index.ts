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
    // 1. Authenticate the caller (the agency owner)
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

    // 2. Verify that the caller is an agency owner and get their agency_id
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? '',
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ''
    );
    const { data: ownerProfile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('agency_id, role')
      .eq('id', agencyOwner.id)
      .single();
    
    if (profileError || !ownerProfile || ownerProfile.role !== 'agency_owner' || !ownerProfile.agency_id) {
      throw new Error("El usuario no es un dueño de agencia válido.");
    }

    // 3. Get the new client's details from the request body
    const { firstName, lastName, email } = await req.json();
    if (!firstName || !lastName || !email) {
      throw new Error("Nombre, apellido y email son requeridos.");
    }

    // 4. Generate a temporary password and create the user
    const temporaryPassword = `temp_${Math.random().toString(36).substring(2, 10)}`;
    
    const { data: createData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: temporaryPassword,
      email_confirm: true, // The user is created and confirmed immediately
      user_metadata: {
        first_name: firstName,
        last_name: lastName,
      }
    });

    if (createError) {
      if (createError.message.includes('User already registered')) {
        throw new Error('Ya existe un usuario con este correo electrónico.');
      }
      throw createError;
    }

    const newUserId = createData.user.id;

    // 5. Update the new user's profile (created by the handle_new_user trigger)
    const { error: updateProfileError } = await supabaseAdmin
      .from('profiles')
      .update({
        role: 'client',
        agency_id: ownerProfile.agency_id,
        plan: 'trial'
      })
      .eq('id', newUserId);

    if (updateProfileError) {
      // Rollback: delete the created user if profile update fails
      await supabaseAdmin.auth.admin.deleteUser(newUserId);
      throw updateProfileError;
    }

    // 6. Send success response with the temporary password
    return new Response(JSON.stringify({ 
      message: `Cliente creado exitosamente.`,
      temporaryPassword: temporaryPassword
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    console.error("Error in create-agency-client:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});