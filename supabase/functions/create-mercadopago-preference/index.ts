// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { MercadoPagoConfig, Preference } from 'https://esm.sh/mercadopago@2.0.9';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FRONTEND_URL = "https://botboxx-demov2.vercel.app";

serve(async (req) => {
  console.log("--- Function create-mercadopago-preference invoked ---");
  console.log(`Request method: ${req.method}`);

  if (req.method === "OPTIONS") {
    console.log("Handling OPTIONS request.");
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    console.log("Parsing request body...");
    const body = await req.json();
    console.log("Request body parsed:", body);
    const { userId, plan, userEmail } = body;

    // Validación más específica
    if (!userId || !plan || !userEmail) {
      console.error("Validation failed: Missing parameters.");
      console.error(`Received: userId=${userId}, plan=${plan}, userEmail=${userEmail}`);
      throw new Error("Faltan parámetros: userId, plan, y userEmail son requeridos.");
    }
    console.log(`Parameters received: userId=${userId}, plan=${plan}, userEmail=${userEmail}`);

    console.log("Retrieving MERCADOPAGO_ACCESS_TOKEN from environment variables...");
    const accessToken = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
    if (!accessToken) {
      console.error("MERCADOPAGO_ACCESS_TOKEN is not set.");
      throw new Error("La clave de acceso de MercadoPago no está configurada en los secretos.");
    }
    
    // Verificar que el token tenga un formato válido (más flexible)
    if (accessToken.length < 20 || (!accessToken.includes('-') && !accessToken.includes('_'))) {
      console.error("Invalid access token format:", accessToken.substring(0, 10) + "...");
      throw new Error("El token de acceso de MercadoPago tiene un formato inválido.");
    }
    console.log("MERCADOPAGO_ACCESS_TOKEN retrieved successfully.");

    console.log("Initializing MercadoPago client...");
    const client = new MercadoPagoConfig({ 
      accessToken,
      options: {
        timeout: 5000, // 5 segundos de timeout
        idempotencyKey: `${userId}-${Date.now()}` // Clave de idempotencia única
      }
    });
    
    const preferenceClient = new Preference(client);
    console.log("MercadoPago client initialized.");

    // Construir los datos de preferencia con validaciones
    const preferenceData = {
      items: [
        {
          id: `premium-plan-${userId}`, // ID único por usuario
          title: "BotBoxx - Plan Premium",
          description: "Suscripción mensual al plan premium de BotBoxx",
          category_id: "services", // Categoría específica
          quantity: 1,
          unit_price: 97,
          currency_id: "USD",
        },
      ],
      payer: {
        email: userEmail,
      },
      back_urls: {
        success: `${FRONTEND_URL}/billing?status=success`,
        failure: `${FRONTEND_URL}/billing?status=failure`,
        pending: `${FRONTEND_URL}/billing?status=pending`,
      },
      auto_return: "approved",
      external_reference: userId,
      // Asegúrate de que la URL del webhook sea correcta y esté accesible
      notification_url: `https://fyagqhcjfuhtjoeqshwk.supabase.co/functions/v1/mercadopago-webhook`,
      
      // Configuraciones adicionales importantes
      expires: true,
      expiration_date_from: new Date().toISOString(),
      expiration_date_to: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 horas
      
      // Métodos de pago permitidos (opcional pero recomendado)
      payment_methods: {
        excluded_payment_types: [],
        excluded_payment_methods: [],
        installments: 1, // Solo pago en 1 cuota
      },
      
      // Configuración de envío (si es necesario)
      shipments: {
        mode: "not_specified", // Para servicios digitales
      }
    };
    
    console.log("Preference data constructed:", JSON.stringify(preferenceData, null, 2));

    console.log("Creating MercadoPago preference...");
    
    // Crear la preferencia con manejo de errores específico
    const result = await preferenceClient.create({ body: preferenceData });
    
    console.log("MercadoPago preference created successfully:");
    console.log("Preference ID:", result.id);
    console.log("Init Point:", result.init_point);
    console.log("Sandbox Init Point:", result.sandbox_init_point);

    // Validar que la respuesta sea correcta
    if (!result || !result.id) {
      console.error("Invalid response from MercadoPago:", result);
      throw new Error("MercadoPago devolvió una respuesta inválida.");
    }

    console.log("--- Function execution successful, sending response. ---");
    return new Response(JSON.stringify({ 
      preferenceId: result.id,
      initPoint: result.init_point,
      sandboxInitPoint: result.sandbox_init_point
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
    
  } catch (error) {
    console.error("--- An error occurred in the function ---");
    console.error("Error type:", error.constructor.name);
    console.error("Error message:", error.message);
    console.error("Error stack:", error.stack);
    
    // Si es un error específico de MercadoPago, proporcionar más contexto
    if (error.cause) {
      console.error("Error cause:", error.cause);
    }
    
    // Devolver un error más específico al cliente
    let errorMessage = "Error interno del servidor.";
    let statusCode = 500;
    
    if (error.message.includes("access token")) {
      errorMessage = "Error de configuración de MercadoPago.";
      statusCode = 500;
    } else if (error.message.includes("parámetros")) {
      errorMessage = error.message;
      statusCode = 400;
    } else if (error.name === "TypeError" && error.message.includes("fetch")) {
      errorMessage = "Error de conectividad con MercadoPago.";
      statusCode = 503;
    }
    
    return new Response(JSON.stringify({ 
      error: errorMessage,
      details: error.message
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: statusCode,
    });
  }
});