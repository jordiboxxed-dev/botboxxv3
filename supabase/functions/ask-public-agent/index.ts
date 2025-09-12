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
      return "El propietario del agente no ha conectado su Google Calendar.";
    }

    let { access_token, refresh_token, expires_at } = creds;

    // Refresh token si es necesario
    if (new Date(expires_at) < new Date()) {
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
        return "Error al refrescar la conexión con Google Calendar.";
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
      return `Error al obtener eventos del calendario: ${errorData.error.message}`;
    }

    const eventsData = await eventsResponse.json();
    if (!eventsData.items || eventsData.items.length === 0) {
      return "No hay eventos próximos en el calendario para los siguientes 7 días.";
    }

    return "Eventos del calendario para los próximos 7 días:\n" + eventsData.items.map(event => {
      const start = event.start.dateTime || event.start.date;
      return `- ${event.summary} (Inicio: ${new Date(start).toLocaleString('es-ES')})`;
    }).join("\n");

  } catch (error) {
    console.error("Error in getCalendarEvents:", error);
    return "Ocurrió un error inesperado al intentar acceder a Google Calendar.";
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

    // --- Lógica de IA (OpenRouter) ---
    const openRouterApiKey = Deno.env.get("OPENROUTER_API_KEY");
    if (!openRouterApiKey) throw new Error("OPENROUTER_API_KEY no está configurada.");

    const personalityPrompt = agentData.system_prompt || "Eres un asistente de IA servicial.";
    const companyName = agentData.company_name || "la empresa";
    const finalSystemPrompt = `
Eres un agente de inteligencia artificial especializado. Tu comportamiento está definido por las siguientes reglas:
1.  **Identidad y Personalidad:**
    *   Tu nombre es un agente de ${companyName}.
    *   Adopta la siguiente personalidad: ${personalityPrompt}
2.  **Proceso de Respuesta (Reglas Obligatorias):**
    *   **PASO 1:** Revisa la "INFORMACIÓN DE HERRAMIENTAS" y la "BASE DE CONOCIMIENTO" para encontrar datos relevantes a la pregunta del usuario.
    *   **PASO 2:** Si la pregunta del usuario implica crear o agendar un evento, tu ÚNICA respuesta debe ser un objeto JSON con el formato: {"tool": "create_calendar_event", "params": {"title": "...", "startTime": "YYYY-MM-DDTHH:MM:SS", "endTime": "YYYY-MM-DDTHH:MM:SS", "attendees": ["email@example.com"]}}. No incluyas ningún otro texto.
    *   **PASO 3:** Si la pregunta NO implica crear un evento, formula una respuesta conversacional basándote ÚNICAMENTE en la información encontrada. Si no encuentras nada relevante, tu única respuesta permitida es: "Lo siento, no tengo información sobre ese tema."

### INFORMACIÓN DE HERRAMIENTAS (DATOS EN TIEMPO REAL) ###
---
[Google Calendar]
${calendarContext}
---

### BASE DE CONOCIMIENTO (DATOS ESTÁTICOS) ###
---
${knowledgeContext}
---

### HISTORIAL DE LA CONVERSACIÓN ###
${(history || []).slice(-4).map(msg => `${msg.role}: ${msg.content}`).join('\n')}
### PREGUNTA DEL USUARIO ###
${prompt}
### TU RESPUESTA (JSON para agendar o texto conversacional) ###
`;
    const messages = [{ role: "system", content: finalSystemPrompt }];

    const openRouterResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openRouterApiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://botboxx-demov2.vercel.app",
        "X-Title": "BotBoxx"
      },
      body: JSON.stringify({
        model: agentData.model || 'mistralai/mistral-7b-instruct',
        messages: messages,
        stream: false, // No usamos stream para poder procesar la respuesta completa
        temperature: 0.1,
      })
    });

    if (!openRouterResponse.ok) {
      const errorBody = await openRouterResponse.json();
      throw new Error(`Error de OpenRouter: ${errorBody.error.message}`);
    }
    
    const responseJson = await openRouterResponse.json();
    const responseText = responseJson.choices[0].message.content;
    let fullResponseText = responseText; // Asignamos el texto completo para guardarlo después
    let finalResponseStream;

    try {
      const parsedResponse = JSON.parse(responseText);
      if (parsedResponse.tool === 'create_calendar_event') {
        if (!agentData.webhook_url) {
          throw new Error("El agente intentó usar una herramienta, pero no hay una URL de Webhook configurada.");
        }
        
        // Llamar al webhook de n8n/Zapier
        const webhookResponse = await fetch(agentData.webhook_url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(parsedResponse.params)
        });

        if (!webhookResponse.ok) {
          throw new Error(`El webhook de acción devolvió un error: ${webhookResponse.statusText}`);
        }

        fullResponseText = "¡Listo! He agendado el evento en el calendario.";
        finalResponseStream = new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(fullResponseText));
            controller.close();
          }
        });

      } else {
        // Es un JSON pero no una herramienta que conocemos, lo tratamos como texto normal
        throw new Error("Respuesta JSON no reconocida como herramienta.");
      }
    } catch (e) {
      // No es un JSON válido o no es una herramienta, así que es una respuesta de texto normal.
      // La convertimos en un stream para que el cliente la reciba igual.
      finalResponseStream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(responseText));
          controller.close();
        }
      });
    }

    // --- Guardar respuesta y devolver stream ---
    await supabaseAdmin.from("public_messages").insert({ conversation_id: conversationId, role: "assistant", content: fullResponseText });

    if (profileData.role !== 'admin') {
      await supabaseAdmin.rpc('increment_message_count', { p_user_id: agentOwnerId });
    }
    
    return new Response(finalResponseStream, {
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