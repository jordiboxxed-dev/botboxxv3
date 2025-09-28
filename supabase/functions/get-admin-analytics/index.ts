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
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? '',
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ''
    );

    // 1. Fetch all raw data
    const { data: { users: usersData }, error: usersError } = await supabaseAdmin.auth.admin.listUsers();
    if (usersError) throw usersError;

    const { data: profilesData, error: profilesError } = await supabaseAdmin
      .from('profiles')
      .select('id, subscribed_at, first_name, last_name, role, agency_id');
    if (profilesError) throw profilesError;

    const { data: agenciesData, error: agenciesError } = await supabaseAdmin
      .from('agencies')
      .select('id, name, owner_id');
    if (agenciesError) throw agenciesError;

    const { data: agentsData, error: agentsError } = await supabaseAdmin
      .from('agents')
      .select('user_id');
    if (agentsError) throw agentsError;

    const { data: privateMessages, error: privateMessagesError } = await supabaseAdmin
      .from('messages')
      .select('user_id');
    if (privateMessagesError) throw privateMessagesError;

    const { data: publicConversations, error: publicConversationsError } = await supabaseAdmin
      .from('public_conversations')
      .select('user_id, public_messages(id)');
    if (publicConversationsError) throw publicConversationsError;

    // 2. Process and map data
    const profilesMap = profilesData.reduce((acc, profile) => {
      acc[profile.id] = profile;
      return acc;
    }, {});

    const agenciesMap = agenciesData.reduce((acc, agency) => {
      acc[agency.id] = { ...agency, clients: [] };
      return acc;
    }, {});

    const agentCounts = agentsData.reduce((acc, agent) => {
      acc[agent.user_id] = (acc[agent.user_id] || 0) + 1;
      return acc;
    }, {});

    const messageCounts = {};
    privateMessages.forEach(msg => {
      messageCounts[msg.user_id] = (messageCounts[msg.user_id] || 0) + 1;
    });
    publicConversations.forEach(conv => {
      const messageCount = conv.public_messages ? conv.public_messages.length : 0;
      messageCounts[conv.user_id] = (messageCounts[conv.user_id] || 0) + messageCount;
    });

    // 3. Calculate stats for each user
    const allUsersWithStats = usersData.map(user => {
      const profile = profilesMap[user.id] || {};
      const message_count = messageCounts[user.id] || 0;
      const totalInteractions = Math.floor(message_count / 2);
      const timeSavedMinutes = totalInteractions * AVG_MINUTES_SAVED_PER_INTERACTION;
      const costSavedUSD = (timeSavedMinutes / 60) * AVG_HOURLY_RATE_USD;

      return {
        id: user.id,
        email: user.email,
        created_at: user.created_at,
        subscribed_at: profile.subscribed_at || null,
        first_name: profile.first_name || null,
        last_name: profile.last_name || null,
        role: profile.role || 'user',
        agency_id: profile.agency_id || null,
        agent_count: agentCounts[user.id] || 0,
        message_count: message_count,
        time_saved: Math.round(timeSavedMinutes),
        cost_saved: parseFloat(costSavedUSD.toFixed(2)),
      };
    });

    // 4. Structure the data by agencies and independent users
    const independentUsers = [];
    const agencyStructures = { ...agenciesMap };

    allUsersWithStats.forEach(user => {
      if (user.role === 'agency_owner' && user.agency_id && agencyStructures[user.agency_id]) {
        agencyStructures[user.agency_id].owner = user;
      } else if (user.role === 'client' && user.agency_id && agencyStructures[user.agency_id]) {
        agencyStructures[user.agency_id].clients.push(user);
      } else if (user.role !== 'admin') { // Exclude admins from the list of independent users
        independentUsers.push(user);
      }
    });

    // 5. Calculate global totals
    const totalAgents = agentsData.length;
    const totalMessages = privateMessages.length + publicConversations.reduce((sum, conv) => {
        const messageCount = conv.public_messages ? conv.public_messages.length : 0;
        return sum + messageCount;
    }, 0);
    
    const totalTimeSaved = allUsersWithStats.reduce((sum, user) => sum + user.time_saved, 0);
    const totalCostSaved = allUsersWithStats.reduce((sum, user) => sum + user.cost_saved, 0);

    const responsePayload = {
      totalUsers: usersData.length,
      totalAgents,
      totalMessages,
      totalTimeSaved,
      totalCostSaved: parseFloat(totalCostSaved.toFixed(2)),
      agencies: Object.values(agencyStructures).filter(a => a.owner), // Only return agencies that have an owner
      independentUsers,
    };

    return new Response(JSON.stringify(responsePayload), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    console.error("Error in get-admin-analytics:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});