import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { showError, showSuccess } from "@/utils/toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, ArrowLeft, CreditCard } from "lucide-react";
import { useUsage } from "@/hooks/useUsage";

const Billing = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { usageInfo, isLoading, refreshUsage } = useUsage();
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const status = params.get('status');

    if (status) {
      if (status === 'success') {
        showSuccess("¡Pago exitoso! Tu plan ha sido actualizado a Premium.");
        refreshUsage();
      } else if (status === 'failure') {
        showError("El pago falló. Por favor, intenta de nuevo o contacta a soporte.");
      } else if (status === 'pending') {
        showSuccess("Tu pago está pendiente. Te notificaremos cuando se complete.");
      }
      // Limpiar los parámetros de la URL
      navigate('/billing', { replace: true });
    }
  }, [location, navigate, refreshUsage]);

  const handleSubscribe = async (plan: string) => {
    setIsProcessing(true);
    
    try {
      // Verificar autenticación
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError) {
        console.error("Auth error:", authError);
        throw new Error("Error de autenticación.");
      }
      
      if (!user) {
        showError("Debes iniciar sesión para suscribirte.");
        setIsProcessing(false);
        return;
      }
  
      // Validar email del usuario
      if (!user.email) {
        showError("Tu cuenta no tiene un email asociado. Contacta soporte.");
        setIsProcessing(false);
        return;
      }
  
      console.log("Invoking MercadoPago preference creation...");
      console.log("User ID:", user.id);
      console.log("User Email:", user.email);
      console.log("Plan:", plan);
  
      // Invocar la función de Edge con timeout
      const { data, error: invokeError } = await Promise.race([
        supabase.functions.invoke('create-mercadopago-preference', {
          body: {
            userId: user.id,
            plan,
            userEmail: user.email,
          }
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error("Timeout: La operación tardó demasiado")), 30000)
        )
      ]) as any;
  
      // Manejar errores de la invocación
      if (invokeError) {
        console.error("Invoke error:", invokeError);
        throw invokeError;
      }
  
      console.log("Function response:", data);
  
      // Validar respuesta
      if (!data) {
        throw new Error("No se recibió respuesta del servidor.");
      }
  
      // Extraer datos de la respuesta
      const { preferenceId, error: preferenceError, initPoint } = data;
      
      if (preferenceError) {
        console.error("Preference error:", preferenceError);
        throw new Error(preferenceError);
      }
  
      if (!preferenceId) {
        console.error("No preference ID received:", data);
        throw new Error("No se pudo generar la preferencia de pago.");
      }
  
      console.log("Preference created successfully:", preferenceId);
      
      // Redirigir a MercadoPago
      // Usar initPoint si está disponible, sino construir la URL
      const redirectUrl = initPoint || `https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=${preferenceId}`;
      
      console.log("Redirecting to:", redirectUrl);
      window.location.href = redirectUrl;
  
    } catch (error: any) {
      console.error("Error creating subscription:", error);
      
      let errorMessage = "Ocurrió un error desconocido.";
      
      // Manejar diferentes tipos de errores
      if (error.message) {
        errorMessage = error.message;
      } else if (error.context?.json?.error) {
        errorMessage = error.context.json.error;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }
      
      // Errores específicos comunes
      if (errorMessage.includes("timeout") || errorMessage.includes("Timeout")) {
        errorMessage = "La operación tardó demasiado. Intenta nuevamente.";
      } else if (errorMessage.includes("network") || errorMessage.includes("fetch")) {
        errorMessage = "Error de conexión. Verifica tu internet e intenta nuevamente.";
      } else if (errorMessage.includes("unauthorized") || errorMessage.includes("auth")) {
        errorMessage = "Error de autenticación. Inicia sesión nuevamente.";
      }
      
      showError("Error al procesar la suscripción: " + errorMessage);
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 p-4 md:p-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-4 mb-8">
            <Skeleton className="h-10 w-10" />
            <Skeleton className="h-8 w-48" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[...Array(3)].map((_, i) => (
              <Card key={i} className="bg-black/30 border-white/10">
                <CardHeader>
                  <Skeleton className="h-6 w-24" />
                  <Skeleton className="h-4 w-32 mt-2" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-4 w-16 mb-4" />
                  <Skeleton className="h-10 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!usageInfo) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-gray-400">No se pudo cargar la información de facturación.</p>
          <Button onClick={() => navigate('/dashboard')} className="mt-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver al dashboard
          </Button>
        </div>
      </div>
    );
  }

  const { plan, trialDaysLeft, isTrialActive } = usageInfo;

  return (
    <div className="min-h-screen bg-gray-900 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">Facturación</h1>
            <p className="text-gray-400">Gestiona tu plan y suscripción</p>
          </div>
          <Button onClick={() => navigate('/dashboard')} variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver
          </Button>
        </div>

        <Card className="bg-black/30 border-white/10 mb-8">
          <CardHeader>
            <CardTitle className="text-white">Plan Actual</CardTitle>
            <CardDescription className="text-gray-400">
              {isTrialActive && trialDaysLeft !== null ? (
                <span>
                  Estás en período de prueba. Te quedan {trialDaysLeft} {trialDaysLeft === 1 ? 'día' : 'días'}.
                </span>
              ) : plan === 'admin' ? (
                <span>Plan administrador con acceso ilimitado.</span>
              ) : (
                <span>Tu plan actual es {plan}.</span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-semibold text-white capitalize">
                  {plan === 'admin' ? 'Administrador' : plan}
                </h3>
              </div>
              {plan !== 'admin' && plan !== 'premium' && (
                <Button 
                  onClick={() => handleSubscribe('premium')} 
                  disabled={isProcessing}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Procesando...
                    </>
                  ) : (
                    <>
                      <CreditCard className="w-4 h-4 mr-2" />
                      Actualizar a Premium
                    </>
                  )}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="bg-black/30 border-white/10">
            <CardHeader>
              <CardTitle className="text-white">Plan Gratuito</CardTitle>
              <CardDescription className="text-gray-400">Para probar la plataforma</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white mb-4">$0<span className="text-lg text-gray-400">/mes</span></div>
              <ul className="space-y-2 mb-6">
                <li className="flex items-center text-gray-300">
                  <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
                  2 agentes
                </li>
                <li className="flex items-center text-gray-300">
                  <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
                  150 mensajes/mes
                </li>
                <li className="flex items-center text-gray-300">
                  <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
                  Soporte básico
                </li>
              </ul>
              {plan === 'trial' && (
                <Button variant="outline" className="w-full" disabled>
                  Plan actual
                </Button>
              )}
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-900/50 to-purple-900/50 border-blue-500/30 md:scale-105">
            <CardHeader>
              <CardTitle className="text-white">Plan Premium</CardTitle>
              <CardDescription className="text-gray-300">Para uso profesional</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white mb-4">$97<span className="text-lg text-gray-300">/mes</span></div>
              <ul className="space-y-2 mb-6">
                <li className="flex items-center text-gray-200">
                  <span className="w-2 h-2 bg-blue-400 rounded-full mr-2"></span>
                  Agentes ilimitados
                </li>
                <li className="flex items-center text-gray-200">
                  <span className="w-2 h-2 bg-blue-400 rounded-full mr-2"></span>
                  Mensajes ilimitados
                </li>
                <li className="flex items-center text-gray-200">
                  <span className="w-2 h-2 bg-blue-400 rounded-full mr-2"></span>
                  Soporte prioritario
                </li>
                <li className="flex items-center text-gray-200">
                  <span className="w-2 h-2 bg-blue-400 rounded-full mr-2"></span>
                  Funcionalidades avanzadas
                </li>
              </ul>
              <Button 
                onClick={() => handleSubscribe('premium')} 
                disabled={isProcessing || plan === 'admin' || plan === 'premium'}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                {isProcessing ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Procesando...</>
                ) : plan === 'premium' ? (
                  "Plan Actual"
                ) : (
                  "Seleccionar plan"
                )}
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-black/30 border-white/10">
            <CardHeader>
              <CardTitle className="text-white">Plan Empresarial</CardTitle>
              <CardDescription className="text-gray-400">Para equipos grandes</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white mb-4">Personalizado</div>
              <ul className="space-y-2 mb-6">
                <li className="flex items-center text-gray-300">
                  <span className="w-2 h-2 bg-purple-500 rounded-full mr-2"></span>
                  Todo lo del plan Premium
                </li>
                <li className="flex items-center text-gray-300">
                  <span className="w-2 h-2 bg-purple-500 rounded-full mr-2"></span>
                  Integraciones personalizadas
                </li>
                <li className="flex items-center text-gray-300">
                  <span className="w-2 h-2 bg-purple-500 rounded-full mr-2"></span>
                  Asistencia dedicada
                </li>
                <li className="flex items-center text-gray-300">
                  <span className="w-2 h-2 bg-purple-500 rounded-full mr-2"></span>
                  SLA garantizado
                </li>
              </ul>
              <Button variant="outline" className="w-full" disabled>
                Contactar ventas
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Billing;