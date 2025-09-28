// @ts-nocheck
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.43.4';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    // --- START: MODIFIED LOGIC FOR PROFILE HANDLING ---
    let { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role, agency_id')
      .eq('id', user.id)
      .single();

    if (profileError && profileError.code !== 'PGRST116') { // PGRST116 = no rows found
      throw new Error("No se pudo obtener el perfil del usuario.");
    }

    if (!profile) {
      // Profile doesn't exist, create it. This can happen on first login.
      const { data: newProfile, error: createError } = await supabaseAdmin
          .from('profiles')
          .insert({
              id: user.id,
              email: user.email,
              first_name: user.user_metadata.first_name || '',
              last_name: user.user_metadata.last_name || '',
          })
          .select('role, agency_id')
          .single();
      
      if (createError) {
          throw new Error("No se pudo crear el perfil de usuario.");
      }
      profile = newProfile;
    }
    // --- END: MODIFIED LOGIC FOR PROFILE HANDLING ---

    let userIdsToQuery = [user.id]; // Default to the current user

    if (profile.role === 'agency_owner' && profile.agency_id) {
      const { data: agencyUsers, error: agencyUsersError } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('agency_id', profile.agency_id);
      
      if (agencyUsersError) throw new Error("No se pudieron cargar los clientes de la agencia.");
      
      // Query for the agency owner and all their clients
      userIdsToQuery = agencyUsers.map(u => u.id);
    }

    const { data: conversations, error: convError } = await supabaseAdmin
      .from('public_conversations')
      .select('id, created_at')
      .in('user_id', userIdsToQuery); // Use the determined list of user IDs
    if (convError) throw convError;

    const totalConversations = conversations.length;
    
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const { data: dailyConversions, error: dailyConversionError } = await supabaseAdmin
      .from('public_conversions')
      .select('created_at')
      .in('user_id', userIdsToQuery) // Use the determined list of user IDs
      .gte('created_at', thirtyDaysAgo);
    if (dailyConversionError) throw dailyConversionError;

    const formatDailyData = (data) => {
      const counts = data.reduce((acc, item) => {
        const date = item.created_at.split('T')[0];
        acc[date] = (acc[date] || 0) + 1;
        return acc;
      }, {});
      
      const result = [];
      for (let i = 29; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateString = d.toISOString().split('T')[0];
        result.push({
          date: dateString,
          count: counts[dateString] || 0,
        });
      }
      return result;
    };

    const dailyConversations = conversations.filter(c => new Date(c.created_at) >= new Date(thirtyDaysAgo));
    const conversationActivity = formatDailyData(dailyConversations).map(d => ({ date: d.date, conversations: d.count }));
    const conversionActivity = formatDailyData(dailyConversions).map(d => ({ date: d.date, conversions: d.count }));

    const combinedActivity = conversationActivity.map((conv, index) => ({
        ...conv,
        conversions: conversionActivity[index].conversions,
    }));

    const { count: totalConversions, error: conversionError } = await supabaseAdmin
      .from('public_conversions')
      .select('*', { count: 'exact', head: true })
      .in('user_id', userIdsToQuery); // Use the determined list of user IDs
    if (conversionError) throw conversionError;

    const autonomousResolutionRate = totalConversations > 0 ? (totalConversions / totalConversations) * 100 : 0;

    if (totalConversations === 0) {
      return new Response(JSON.stringify({
        totalConversations: 0,
        totalMessages: 0,
        totalConversions: 0,
        timeSavedMinutes: 0,
        costSavedUSD: 0,
        avgMessagesPerConversation: 0,
        autonomousResolutionRate: 0,
        activity: combinedActivity,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const conversationIds = conversations.map(c => c.id);
    
    let totalMessages = 0;
    if (conversationIds.length > 0) {
        const { count, error: msgError } = await supabaseAdmin
          .from('public_messages')
          .select('*', { count: 'exact', head: true })
          .in('conversation_id', conversationIds);
        if (msgError) throw msgError;
        totalMessages = count || 0;
    }
    
    const totalInteractions = Math.floor(totalMessages / 2);
    const timeSavedMinutes = totalInteractions * AVG_MINUTES_SAVED_PER_INTERACTION;
    const costSavedUSD = (timeSavedMinutes / 60) * AVG_HOURLY_RATE_USD;
    const avgMessagesPerConversation = totalConversations > 0 ? (totalMessages / totalConversations) : 0;

    const responsePayload = {
      totalConversations,
      totalMessages,
      totalConversions: totalConversions || 0,
      timeSavedMinutes: Math.round(timeSavedMinutes),
      costSavedUSD: parseFloat(costSavedUSD.toFixed(2)),
      avgMessagesPerConversation: parseFloat(avgMessagesPerConversation.toFixed(1)),
      autonomousResolutionRate: parseFloat(autonomousResolutionRate.toFixed(1)),
      activity: combinedActivity,
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