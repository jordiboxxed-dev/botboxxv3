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

    // 4. Crear el nuevo usuario con una invitación por email
    const { data: newUser, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
      email,
      email_confirm: true, // El cliente recibirá un email para confirmar y establecer su contraseña
      user_metadata: {
        first_name: firstName,
        last_name: lastName,
      }
    });

    if (createUserError) throw createUserError;

    // 5. Crear el perfil para el nuevo usuario
    const { error: createProfileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: newUser.user.id,
        email: newUser.user.email,
        first_name: firstName,
        last_name: lastName,
        role: 'client', // Asignar el rol 'client'
        agency_id: ownerProfile.agency_id, // Vincular a la agencia del dueño
        plan: 'agency_client' // Asignar un plan específico para clientes de agencia
      });

    if (createProfileError) {
      // Si la creación del perfil falla, eliminamos el usuario de autenticación para evitar datos huérfanos
      await supabaseAdmin.auth.admin.deleteUser(newUser.user.id);
      throw createProfileError;
    }

    // 6. Enviar respuesta de éxito
    return new Response(JSON.stringify({ message: "Cliente creado exitosamente. Se ha enviado una invitación a su email." }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    console.error("Error en create-agency-client:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});