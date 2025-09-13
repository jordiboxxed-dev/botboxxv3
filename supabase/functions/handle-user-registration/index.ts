// @ts-nocheck
import { serve } from "std/http/server.ts";
import { createClient } from '@supabase/supabase-js';

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
    const { email, password, firstName, lastName } = await req.json();

    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: "Email y contraseña son requeridos" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    // Usar service role key para operaciones administrativas
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? '',
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ''
    );

    // Registrar usuario
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: false, // El usuario debe confirmar su email
      user_metadata: { 
        first_name: firstName || '',
        last_name: lastName || ''
      }
    });

    if (error) throw error;

    // Crear perfil automáticamente
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: data.user.id,
        email: data.user.email,
        first_name: firstName || '',
        last_name: lastName || '',
        role: 'user'
      });

    if (profileError) {
      console.error('Error creating profile:', profileError);
      // No lanzamos error aquí porque el usuario ya fue creado
    }

    return new Response(
      JSON.stringify({ message: "Usuario registrado exitosamente. Revisa tu email para confirmar." }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error in handle-user-registration:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});