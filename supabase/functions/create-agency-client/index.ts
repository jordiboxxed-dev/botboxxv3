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
    // 1. Autenticar al llamador (el dueño de la agencia)
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

    // 2. Verificar que el llamador es un dueño de agencia y obtener su agency_id
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

    // 3. Obtener los detalles del nuevo cliente del cuerpo de la solicitud
    const { firstName, lastName, email } = await req.json();
    if (!firstName || !lastName || !email) {
      throw new Error("Nombre, apellido y email son requeridos.");
    }

    // 4. Generar una contraseña temporal
    const tempPassword = `temp_${crypto.randomUUID().slice(0, 10)}`;

    // 5. Crear al nuevo usuario directamente con la contraseña temporal
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true, // La cuenta es creada por una fuente confiable (dueño de agencia)
      user_metadata: {
        first_name: firstName,
        last_name: lastName,
      }
    });

    if (createError) throw createError;

    // 6. Actualizar el perfil del nuevo usuario (creado por el trigger handle_new_user)
    const { error: updateProfileError } = await supabaseAdmin
      .from('profiles')
      .update({
        role: 'client',
        agency_id: ownerProfile.agency_id,
        plan: 'agency_client'
      })
      .eq('id', newUser.user.id);

    if (updateProfileError) {
      // Si la actualización del perfil falla, eliminamos el usuario de autenticación para evitar datos huérfanos
      await supabaseAdmin.auth.admin.deleteUser(newUser.user.id);
      throw updateProfileError;
    }

    // 7. Enviar respuesta de éxito con las credenciales temporales
    return new Response(JSON.stringify({ 
      message: "Cliente creado exitosamente.",
      email: email,
      tempPassword: tempPassword
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