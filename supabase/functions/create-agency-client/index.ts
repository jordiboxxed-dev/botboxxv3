// @ts-nocheck
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.43.4';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Function to generate a random password
const generatePassword = (length = 12) => {
  const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()";
  let password = "";
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * charset.length);
    password += charset[randomIndex];
  }
  return password;
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

    // 4. Generate a temporary password
    const temporaryPassword = generatePassword();

    // 5. Create the new user with email and password
    const { data: newUser, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: temporaryPassword,
      email_confirm: true, // Auto-confirm email since we are creating them
      user_metadata: {
        first_name: firstName,
        last_name: lastName,
      }
    });

    if (createUserError) throw createUserError;

    // 6. Update the new user's profile (created by the handle_new_user trigger)
    const { error: updateProfileError } = await supabaseAdmin
      .from('profiles')
      .update({
        role: 'client',
        agency_id: ownerProfile.agency_id,
        plan: 'agency_client'
      })
      .eq('id', newUser.user.id);

    if (updateProfileError) {
      // If updating the profile fails, delete the auth user to prevent orphaned data
      await supabaseAdmin.auth.admin.deleteUser(newUser.user.id);
      throw updateProfileError;
    }

    // 7. Send success response with the temporary credentials
    return new Response(JSON.stringify({ 
      message: "Cliente creado exitosamente.",
      credentials: {
        email: newUser.user.email,
        password: temporaryPassword
      }
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