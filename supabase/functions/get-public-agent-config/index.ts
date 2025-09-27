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
    const { agentId } = await req.json();
    if (!agentId) {
      throw new Error("agentId es requerido.");
    }

    // Use service role key to bypass RLS for this public query
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? '',
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ''
    );

    const { data, error } = await supabaseAdmin
      .from("agents")
      .select("name, company_name, widget_color, widget_welcome_message, widget_position, status, deleted_at, avatar_url, public_background_url")
      .eq("id", agentId)
      .single();

    if (error) throw error;
    
    // Handle case where agent is not found
    if (!data) {
      throw new Error("Agente no encontrado.");
    }
    
    // Verificar si el agente está activo y no ha sido eliminado
    if (data.status !== 'active' || data.deleted_at) {
      throw new Error("Este agente no está disponible públicamente.");
    }

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});