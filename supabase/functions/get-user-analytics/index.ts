// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LEAD_KEYWORDS = [
  'agendar', 'reunión', 'visita', 'contacto', 'llamar', 'email', 'precio', 'comprar', 'cotizar', 'presupuesto', 'información', 'interesado'
];
const AVG_HOURLY_RATE_USD = 15;
const AVG_MINUTES_SAVED_PER_INTERACTION = 2.5;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error("Falta el encabezado de autorización.");
    const token = authHeader.replace('Bearer ', '');
    
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? '',
      Deno.env.get("SUPABASE_ANON_KEY") ?? '',
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error("Token de usuario inválido.");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? '',
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ''
    );

    const { data: conversations, error: convError } = await supabaseAdmin
      .from('public_conversations')
      .select('id')
      .eq('user_id', user.id);
    if (convError) throw convError;

    const totalConversations = conversations.length;
    if (totalConversations === 0) {
      return new Response(JSON.stringify({
        totalConversations: 0,
        totalMessages: 0,
        leadsGenerated: 0,
        timeSavedMinutes: 0,
        costSavedUSD: 0,
        avgMessagesPerConversation: 0,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const conversationIds = conversations.map(c => c.id);

    const { data: messages, error: msgError } = await supabaseAdmin
      .from('public_messages')
      .select('content, role, conversation_id')
      .in('conversation_id', conversationIds);
    if (msgError) throw msgError;

    const totalMessages = messages.length;
    
    const conversationsWithLeadKeyword = new Set();
    for (const message of messages) {
        if (message.role === 'user' && LEAD_KEYWORDS.some(keyword => message.content.toLowerCase().includes(keyword))) {
            conversationsWithLeadKeyword.add(message.conversation_id);
        }
    }
    const leadsGenerated = conversationsWithLeadKeyword.size;

    const totalInteractions = Math.floor(totalMessages / 2);
    const timeSavedMinutes = totalInteractions * AVG_MINUTES_SAVED_PER_INTERACTION;
    const costSavedUSD = (timeSavedMinutes / 60) * AVG_HOURLY_RATE_USD;
    const avgMessagesPerConversation = totalConversations > 0 ? (totalMessages / totalConversations) : 0;

    const responsePayload = {
      totalConversations,
      totalMessages,
      leadsGenerated,
      timeSavedMinutes: Math.round(timeSavedMinutes),
      costSavedUSD: parseFloat(costSavedUSD.toFixed(2)),
      avgMessagesPerConversation: parseFloat(avgMessagesPerConversation.toFixed(1)),
    };

    return new Response(JSON.stringify(responsePayload), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    console.error("Error in get-user-analytics:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});