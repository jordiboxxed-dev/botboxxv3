// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? '',
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ''
    );

    // Fetch all users
    const { data: usersData, error: usersError } = await supabaseAdmin
      .from('users')
      .select('id, email, created_at')
      .order('created_at', { ascending: false });

    if (usersError) throw usersError;

    const userIds = usersData.map(u => u.id);

    // Fetch all agents and group by user
    const { data: agentsData, error: agentsError } = await supabaseAdmin
      .from('agents')
      .select('user_id');

    if (agentsError) throw agentsError;

    const agentCounts = agentsData.reduce((acc, agent) => {
      acc[agent.user_id] = (acc[agent.user_id] || 0) + 1;
      return acc;
    }, {});

    // Fetch all messages (private and public) and group by user
    const { data: privateMessages, error: privateMessagesError } = await supabaseAdmin
      .from('messages')
      .select('user_id');
    
    if (privateMessagesError) throw privateMessagesError;

    const { data: publicConversations, error: publicConversationsError } = await supabaseAdmin
      .from('public_conversations')
      .select('user_id, public_messages(id)');

    if (publicConversationsError) throw publicConversationsError;

    const messageCounts = {};
    privateMessages.forEach(msg => {
      messageCounts[msg.user_id] = (messageCounts[msg.user_id] || 0) + 1;
    });
    publicConversations.forEach(conv => {
      messageCounts[conv.user_id] = (messageCounts[conv.user_id] || 0) + conv.public_messages.length;
    });

    // Combine data
    const usersWithStats = usersData.map(user => ({
      id: user.id,
      email: user.email,
      created_at: user.created_at,
      agent_count: agentCounts[user.id] || 0,
      message_count: messageCounts[user.id] || 0,
    }));

    const totalAgents = agentsData.length;
    const totalMessages = privateMessages.length + publicConversations.reduce((sum, conv) => sum + conv.public_messages.length, 0);

    const responsePayload = {
      totalUsers: usersData.length,
      totalAgents,
      totalMessages,
      usersWithStats,
    };

    return new Response(JSON.stringify(responsePayload), {
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