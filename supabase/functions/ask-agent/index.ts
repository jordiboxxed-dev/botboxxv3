// @ts-nocheck
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.43.4';
import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai@0.11.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// --- Helper para obtener/refrescar tokens de Google ---
async function getGoogleAuthTokens(userId, supabaseAdmin) {
  const { data: creds, error: credsError } = await supabaseAdmin
    .from("user_credentials")
    .select("access_token, refresh_token, expires_at")
    .eq("user_id", userId)
    .eq("service", "google_calendar")
    .single();

  if (credsError || !creds) {
    return { error: "El usuario no ha conectado su Google Calendar." };
  }

  let { access_token, refresh_token, expires_at } = creds;

  if (new Date(expires_at) < new Date()) {
    if (!refresh_token) {
      await supabaseAdmin.from("user_credentials").delete().eq("user_id", userId).eq("service", "google_calendar");
      return { error: "La conexión con Google Calendar ha expirado. Por favor, vuelve a conectar tu calendario." };
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
      if (newTokens.error === 'invalid_grant') {
        await supabaseAdmin.from("user_credentials").delete().eq("user_id", userId).eq("service", "google_calendar");
        return { error: "La autorización de Google Calendar fue revocada. Por favor, vuelve a conectar tu calendario." };
      }
      return { error: "Error al refrescar la conexión con Google Calendar." };
    }

    access_token = newTokens.access_token;
    const new_expires_at = new Date(Date.now() + newTokens.expires_in * 1000).toISOString();

    await supabaseAdmin
      .from("user_credentials")
      .update({ access_token: access_token, expires_at: new_expires_at })
      .eq("user_id", userId)
      .eq("service", "google_calendar");
  }
  
  return { access_token };
}

// --- Helper para Google Calendar ---
async function getCalendarEvents(userId, supabaseAdmin) {
  try {
    const { access_token, error } = await getGoogleAuthTokens(userId, supabaseAdmin);
    if (error) return { error, events: [] };

    const timeMin = new Date().toISOString();
    const timeMax = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    
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
      return { error: `Error al obtener eventos: ${errorData.error.message}`, events: [] };
    }

    const eventsData = await eventsResponse.json();
    if (!eventsData.items || eventsData.items.length === 0) {
      return { summary: "No hay eventos próximos en el calendario para los siguientes 7 días.", events: [] };
    }

    const events = eventsData.items.map(event => ({
      summary: event.summary,
      startTime: event.start.dateTime || event.start.date,
      endTime: event.end.dateTime || event.end.date,
    }));

    return { summary: `Hay ${events.length} evento(s) en el calendario.`, events: events };
  } catch (error) {
    console.error("Error in getCalendarEvents:", error);
    return { error: "Error inesperado al acceder a Google Calendar.", events: [] };
  }
}

// --- Helper para crear eventos en Google Calendar ---
async function createCalendarEvent(userId, params, supabaseAdmin) {
  try {
    const { access_token, error } = await getGoogleAuthTokens(userId, supabaseAdmin);
    if (error) return { success: false, message: `Error de autenticación: ${error}` };

    const startTime = new Date(params.startTime);
    const endTime = new Date(startTime.getTime() + params.durationMinutes * 60000);

    const event = {
      summary: params.title,
      start: {
        dateTime: startTime.toISOString(),
        timeZone: 'America/Argentina/Buenos_Aires',
      },
      end: {
        dateTime: endTime.toISOString(),
        timeZone: 'America/Argentina/Buenos_Aires',
      },
      attendees: params.attendees.map(email => ({ email })),
      reminders: {
        useDefault: true,
      },
    };

    const createResponse = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=all', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(event),
    });

    if (!createResponse.ok) {
      const errorData = await createResponse.json();
      return { success: false, message: `Error al agendar en Google Calendar: ${errorData.error.message}` };
    }

    return { success: true, message: `¡Perfecto! He agendado la reunión "${params.title}". Se ha enviado una invitación a los participantes.` };
  } catch (error) {
    console.error("Error in createCalendarEvent:", error);
    return { success: false, message: "Error inesperado al crear el evento en Google Calendar." };
  }
}

const checkMessageLimit = async (userId, supabaseAdmin) => {
    const { data: profile, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select('plan, trial_ends_at, role')
        .eq('id', userId)
        .single();

    if (profileError) throw new Error("No se pudo verificar el perfil del usuario.");
    if (profile.role === 'admin') return; // Admins have no limits

    const { plan, trial_ends_at } = profile;

    const getLimits = (p) => {
        switch (p) {
            case 'trial': return { msg: 150, name: 'Prueba' };
            case 'pro': return { msg: 1000, name: 'Pro' };
            case 'premium': return { msg: 10000, name: 'Premium' };
            default: return { msg: Infinity, name: 'Desconocido' };
        }
    };

    const limits = getLimits(plan);

    if (plan === 'trial' && trial_ends_at && new Date(trial_ends_at) < new Date()) {
        throw new Error("Tu período de prueba ha expirado. Por favor, actualiza tu plan para continuar.");
    }

    const currentMonthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
    
    const { data: usage, error: usageError } = await supabaseAdmin
        .from('usage_stats')
        .select('messages_sent')
        .eq('user_id', userId)
        .eq('month_start', currentMonthStart)
        .single();

    if (usageError && usageError.code !== 'PGRST116') { // PGRST116 = no rows found, which is fine
        throw new Error("No se pudo verificar el uso de mensajes.");
    }

    const messagesSent = usage?.messages_sent || 0;

    if (messagesSent >= limits.msg) {
        throw new Error(`Has alcanzado el límite de ${limits.msg} mensajes de tu plan ${limits.name}.`);
    }
};

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

    const { agentId, prompt, history } = await req.json();
    if (!agentId || !prompt) throw new Error("agentId y prompt son requeridos.");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? '',
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ''
    );

    await checkMessageLimit(user.id, supabaseAdmin);

    const { data: agentData, error: agentError } = await supabaseAdmin.from("agents").select("system_prompt, model, company_name, webhook_url").eq("id", agentId).single();
    if (agentError) throw new Error("No se pudo encontrar el agente.");

    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiApiKey) throw new Error("GEMINI_API_KEY no está configurada.");
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
        p_source_ids: sourceIds
      });
      if (matchError) throw matchError;
      if (chunks && chunks.length > 0) {
        knowledgeContext = chunks.map(c => c.content).join("\n\n---\n\n");
      }
    }

    const googleClientId = Deno.env.get("GOOGLE_CLIENT_ID");
    const googleClientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");

    let calendarContext = { summary: "La herramienta de Google Calendar no está configurada por el administrador.", events: [] };
    if (googleClientId && googleClientSecret) {
        calendarContext = await getCalendarEvents(user.id, supabaseAdmin);
    }
    
    let responseText;

    if (agentData.webhook_url && agentData.webhook_url.trim() !== "") {
      const webhookPayload = {
        agent: { id: agentId, system_prompt: agentData.system_prompt, company_name: agentData.company_name, model: agentData.model },
        user: { id: user.id, email: user.email },
        prompt: prompt,
        history: history || [],
        context: { knowledge: knowledgeContext, calendar: calendarContext }
      };

      const webhookResponse = await fetch(agentData.webhook_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(webhookPayload)
      });

      if (!webhookResponse.ok) {
        const errorText = await webhookResponse.text();
        throw new Error(`El webhook devolvió un error (${webhookResponse.status}): ${errorText}`);
      }

      const responseData = await webhookResponse.json();
      responseText = responseData.output;

      if (typeof responseText !== 'string') {
        throw new Error("La respuesta del webhook no tiene el formato esperado { \"output\": \"...\" }");
      }
    } else {
      console.log("No webhook URL found. Using direct Gemini call.");
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
      const chatHistory = (history || []).map(msg => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }]
      }));
      const finalSystemPrompt = `
        ${agentData.system_prompt}
        --- CONTEXTO DE LA BASE DE CONOCIMIENTO ---
        ${knowledgeContext}
        --- FIN DEL CONTEXTO ---
        --- CONTEXTO DEL CALENDARIO ---
        Resumen: ${calendarContext.summary}
        Eventos: ${JSON.stringify(calendarContext.events, null, 2)}
        --- FIN DEL CONTEXTO ---
      `;
      const chat = model.startChat({
        history: chatHistory,
        systemInstruction: finalSystemPrompt,
      });
      const result = await chat.sendMessage(prompt);
      responseText = result.response.text();
    }

    // --- Tool Execution Logic (runs for both webhook and direct call) ---
    try {
      const toolCall = JSON.parse(responseText);
      if (toolCall.tool === 'create_calendar_event' && toolCall.params) {
        console.log("Tool call detected: create_calendar_event");
        const result = await createCalendarEvent(user.id, toolCall.params, supabaseAdmin);
        responseText = result.message;
      }
    } catch (e) {
      // Not a JSON or not a valid tool call, treat as plain text.
    }

    const { data: profileData } = await supabaseAdmin.from('profiles').select('role').eq('id', user.id).single();
    if (profileData && profileData.role !== 'admin') {
      await supabaseAdmin.rpc('increment_message_count', { p_user_id: user.id });
    }

    return new Response(responseText, {
      headers: { ...corsHeaders, "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch (error) {
    console.error("Error in ask-agent function:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});