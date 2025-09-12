// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// --- Helper para Google Calendar ---
async function getCalendarEvents(userId, supabaseAdmin) {
  try {
    const { data: creds, error: credsError } = await supabaseAdmin
      .from("user_credentials")
      .select("access_token, refresh_token, expires_at")
      .eq("user_id", userId)
      .eq("service", "google_calendar")
      .single();

    if (credsError || !creds) {
      return {
        summary: "El propietario del agente no ha conectado su Google Calendar.",
        events: []
      };
    }

    let { access_token, refresh_token, expires_at } = creds;

    // Refresh token si es necesario
    if (new Date(expires_at) < new Date()) {
      if (!refresh_token) {
        console.error(`Refresh token missing for user ${userId}. Deleting credentials to force re-auth.`);
        await supabaseAdmin.from("user_credentials").delete().eq("user_id", userId).eq("service", "google_calendar");
        return { error: "La conexión con Google Calendar ha expirado. El propietario del agente debe volver a conectarlo.", events: [] };
      }

      const googleClientId = Deno.env.get("GOOGLE_CLIENT_ID");
      const googleClientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
      
      const refreshResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: googleClientId,
          client_secret: googleClientSecret,
          refresh_token: refresh_token,
          grant_type: "refresh_token",
        }),
      });

      const newTokens = await refreshResponse.json();
      if (newTokens.error) {
        console.error("Error refreshing token:", newTokens.error_description);
        if (newTokens.error === 'invalid_grant') {
          console.error(`Invalid grant for user ${userId}. Deleting credentials.`);
          await supabaseAdmin.from("user_credentials").delete().eq("user_id", userId).eq("service", "google_calendar");
          return { error: "La autorización de Google Calendar fue revocada. El propietario del agente debe volver a conectarlo.", events: [] };
        }
        return {
          error: "Error al refrescar la conexión con Google Calendar.",
          events: []
        };
      }

      access_token = newTokens.access_token;
      const new_expires_at = new Date(Date.now() + newTokens.expires_in * 1000).toISOString();

      await supabaseAdmin
        .from("user_credentials")
        .update({ access_token: access_token, expires_at: new_expires_at })
        .eq("user_id", userId)
        .eq("service", "google_calendar");
    }

    // Fetch events
    const timeMin = new Date().toISOString();
    const timeMax = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // Próximos 7 días
    
    const calendarApiUrl = new URL("https://www.googleapis.com/calendar/v3/calendars/primary/events");
    calendarApiUrl.searchParams.set("timeMin", timeMin);
    calendarApiUrl.searchParams.set("timeMax", timeMax);
    calendarApiUrl.searchParams.set("singleEvents", "true");
    calendarApiUrl.searchParams.set("orderBy", "startTime");
    calendarApiUrl.searchParams.set("maxResults", "15");

    const eventsResponse = await fetch(calendarApiUrl.toString(), {
      headers: { "Authorization": `Bearer ${access_token}` },
    });

    if (!eventsResponse.ok) {
      const errorData = await eventsResponse.json();
      console.error("Google Calendar API error:", errorData);
      return {
        error: `Error al obtener eventos del calendario: ${errorData.error.message}`,
        events: []
      };
    }

    const eventsData = await eventsResponse.json();
    if (!eventsData.items || eventsData.items.length === 0) {
      return {
        summary: "No hay eventos próximos en el calendario para los siguientes 7 días.",
        events: []
      };
    }

    const events = eventsData.items.map(event => ({
      summary: event.summary,
      startTime: event.start.dateTime || event.start.date,
      endTime: event.end.dateTime || event.end.date,
    }));

    return {
      summary: `Hay ${events.length} evento(s) en el calendario para los próximos 7 días.`,
      events: events
    };

  } catch (error) {
    console.error("Error in getCalendarEvents:", error);
    return {
      error: "Ocurrió un error inesperado al intentar acceder a Google Calendar.",
      events: []
    };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { agentId, prompt, history, conversationId } = await req.json();
    if (!agentId || !prompt || !conversationId) {
      throw new Error("agentId, prompt y conversationId son requeridos.");
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? '',
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ''
    );
    
    const { data: agentData, error: agentError } = await supabaseAdmin.from("agents").select("system_prompt, user_id, company_name, status, deleted_at, model, webhook_url").eq("id", agentId).single();
    if (agentError) throw new Error("No se pudo encontrar el agente.");
    if (agentData.status !== 'active' || agentData.deleted_at) {
      throw new Error("Este agente no está activo y no puede recibir mensajes.");
    }
    
    if (!agentData.webhook_url) {
      throw new Error("Este agente no tiene un Webhook de Acciones configurado y no puede procesar mensajes públicos.");
    }

    const { user_id: agentOwnerId } = agentData;

    // --- Verificación de Plan y Límites del Propietario ---
    const { data: profileData, error: profileError } = await supabaseAdmin.from('profiles').select('plan, trial_ends_at, role').eq('id', agentOwnerId).single();
    if (profileError) throw new Error("No se pudo verificar el perfil del propietario del agente.");

    if (profileData.role !== 'admin' && profileData.plan === 'trial') {
      if (profileData.trial_ends_at && new Date(profileData.trial_ends_at) < new Date()) {
        throw new Error("El período de prueba para este agente ha expirado. El propietario necesita actualizar su plan.");
      }
      const TRIAL_MESSAGE_LIMIT = 150;
      const { data: usageData, error: usageError } = await supabaseAdmin.from('usage_stats').select('messages_sent').eq('user_id', agentOwnerId);
      if (usageError) throw new Error("No se pudo verificar el uso de mensajes del propietario del agente.");
      const totalMessagesSent = usageData.reduce((sum, record) => sum + record.messages_sent, 0);
      if (totalMessagesSent >= TRIAL_MESSAGE_LIMIT) {
        throw new Error(`Límite total de mensajes del plan de prueba (${TRIAL_MESSAGE_LIMIT}) alcanzado. El propietario necesita actualizar su plan.`);
      }
    }

    await supabaseAdmin.from("public_conversations").upsert({ id: conversationId, agent_id: agentId, user_id: agentOwnerId });
    await supabaseAdmin.from("public_messages").insert({ conversation_id: conversationId, role: "user", content: prompt });

    // --- Obtener Contexto de la Base de Conocimiento ---
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiApiKey) throw new Error("GEMINI_API_KEY no está configurada para embeddings.");
    const genAI = new GoogleGenerativeAI(geminiApiKey);
    const embeddingModel = genAI.getGenerativeModel({ model: "text-embedding-004" });

    const { data: sources, error: sourcesError } = await supabaseAdmin.from("knowledge_sources").select("id").eq("agent_id", agentId);
    if (sourcesError) throw sourcesError;
    const sourceIds = sources.map(s => s.id);

    let knowledgeContext = "No se encontró información relevante en la base de conocimiento.";
    if (sourceIds.length > 0) {
        const promptEmbedding = await embeddingModel.embedContent(prompt);
        const { data: chunks, error: matchError } = await supabaseAdmin.rpc('match_knowledge_chunks', {
            query_embedding: promptEmbedding.embedding.values,
            match_threshold: 0.3,
            match_count: 15,
            source_ids: sourceIds
        });
        if (matchError) throw matchError;
        if (chunks && chunks.length > 0) {
            knowledgeContext = chunks.map(c => c.content).join("\n\n---\n\n");
        }
    }

    // --- Obtener Contexto de Herramientas (Google Calendar) ---
    const calendarContext = await getCalendarEvents(agentOwnerId, supabaseAdmin);

    // --- LÓGICA PRINCIPAL: Enviar todo al Webhook de n8n ---
    const webhookPayload = {
      agent: {
        id: agentId,
        system_prompt: agentData.system_prompt,
        company_name: agentData.company_name,
        model: agentData.model,
      },
      user: {
        id: null,
        conversationId: conversationId,
      },
      prompt: prompt,
      history: history || [],
      context: {
        knowledge: knowledgeContext,
        calendar: calendarContext,
      }
    };

    const webhookResponse = await fetch(agentData.webhook_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(webhookPayload)
    });

    if (!webhookResponse.ok) {
      const errorText = await webhookResponse.text();
      throw new Error(`El webhook de n8n devolvió un error (${webhookResponse.status}): ${errorText}`);
    }

    // --- Procesar la respuesta del Webhook ---
    const responseData = await webhookResponse.json();
    const responseText = responseData.output;

    if (typeof responseText !== 'string') {
      throw new Error("La respuesta del webhook no tiene el formato esperado { \"output\": \"...\" }");
    }

    // --- Incrementar contador de mensajes del propietario ---
    if (profileData.role !== 'admin') {
      await supabaseAdmin.rpc('increment_message_count', { p_user_id: agentOwnerId });
    }
    
    // --- Guardar respuesta y devolver stream ---
    await supabaseAdmin.from("public_messages").insert({ conversation_id: conversationId, role: "assistant", content: responseText });

    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(responseText));
        controller.close();
      },
    });

    return new Response(stream, {
      headers: { ...corsHeaders, "Content-Type": "text/plain" },
    });

  } catch (error) {
    console.error("Error in ask-public-agent function:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});