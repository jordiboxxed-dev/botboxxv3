import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { showError, showSuccess } from "@/utils/toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, ArrowLeft, CreditCard, Zap } from "lucide-react";
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
        showSuccess("¡Pago exitoso! Tu plan ha sido actualizado.");
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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !user.email) {
        showError("Usuario no válido o sin email. Por favor, inicia sesión de nuevo.");
        setIsProcessing(false);
        return;
      }
  
      const { data, error: invokeError } = await supabase.functions.invoke('create-mercadopago-preference', {
        body: { userId: user.id, plan, userEmail: user.email }
      });
  
      if (invokeError) throw invokeError;
      if (!data || data.error) throw new Error(data?.error || "No se pudo generar la preferencia de pago.");
  
      const { initPoint } = data;
      if (!initPoint) throw new Error("No se recibió la URL de pago.");
      
      window.location.href = initPoint;
  
    } catch (error: any) {
      showError("Error al procesar la suscripción: " + (error.message || "Ocurrió un error desconocido."));
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 p-4 md:p-8">
        <div className="max-w-6xl mx-auto">
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
      <div className="max-w-6xl mx-auto">
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
                <span>Estás en período de prueba. Te quedan {trialDaysLeft} {trialDaysLeft === 1 ? 'día' : 'días'}.</span>
              ) : plan === 'admin' ? (
                <span>Plan administrador con acceso ilimitado.</span>
              ) : (
                <span>Tu plan actual es <span className="font-semibold capitalize">{plan}</span>.</span>
              )}
            </CardDescription>
          </CardHeader>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Plan Gratuito */}
          <Card className="bg-black/30 border-white/10">
            <CardHeader>
              <CardTitle className="text-white">Plan Gratuito</CardTitle>
              <CardDescription className="text-gray-400">Para probar</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white mb-4">$0<span className="text-lg text-gray-400">/mes</span></div>
              <ul className="space-y-2 mb-6 text-sm">
                <li className="flex items-center text-gray-300"><span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>2 agentes</li>
                <li className="flex items-center text-gray-300"><span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>150 mensajes/mes</li>
              </ul>
              {plan === 'trial' && <Button variant="outline" className="w-full" disabled>Plan actual</Button>}
            </CardContent>
          </Card>

          {/* Plan Pro */}
          <Card className="bg-gradient-to-br from-indigo-900/50 to-purple-900/50 border-indigo-500/30">
            <CardHeader>
              <CardTitle className="text-white">Plan Pro</CardTitle>
              <CardDescription className="text-gray-300">Más poder</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white mb-4">$97<span className="text-lg text-gray-300">/mes</span></div>
              <ul className="space-y-2 mb-6 text-sm">
                <li className="flex items-center text-gray-200"><span className="w-2 h-2 bg-indigo-400 rounded-full mr-2"></span>5 agentes</li>
                <li className="flex items-center text-gray-200"><span className="w-2 h-2 bg-indigo-400 rounded-full mr-2"></span>1,000 mensajes/mes</li>
                <li className="flex items-center font-semibold text-indigo-300"><Zap className="w-4 h-4 mr-2"/>Herramientas</li>
              </ul>
              <Button onClick={() => handleSubscribe('pro')} disabled={isProcessing || plan === 'pro' || plan === 'premium' || plan === 'admin'} className="w-full bg-indigo-600 hover:bg-indigo-700">
                {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : plan === 'pro' ? "Plan Actual" : "Seleccionar"}
              </Button>
            </CardContent>
          </Card>

          {/* Plan Premium */}
          <Card className="bg-gradient-to-br from-blue-900/50 to-purple-900/50 border-blue-500/30 md:scale-105">
            <CardHeader>
              <CardTitle className="text-white">Plan Premium</CardTitle>
              <CardDescription className="text-gray-300">Uso profesional</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white mb-4">$297<span className="text-lg text-gray-300">/mes</span></div>
              <ul className="space-y-2 mb-6 text-sm">
                <li className="flex items-center text-gray-200"><span className="w-2 h-2 bg-blue-400 rounded-full mr-2"></span>Agentes ilimitados</li>
                <li className="flex items-center text-gray-200"><span className="w-2 h-2 bg-blue-400 rounded-full mr-2"></span>10,000 mensajes/mes</li>
                <li className="flex items-center text-gray-200"><span className="w-2 h-2 bg-blue-400 rounded-full mr-2"></span>Cobro por uso excedente</li>
                <li className="flex items-center font-semibold text-blue-300"><Zap className="w-4 h-4 mr-2"/>Herramientas</li>
                <li className="flex items-center text-gray-200"><span className="w-2 h-2 bg-blue-400 rounded-full mr-2"></span>Soporte prioritario</li>
              </ul>
              <Button onClick={() => handleSubscribe('premium')} disabled={isProcessing || plan === 'premium' || plan === 'admin'} className="w-full bg-blue-600 hover:bg-blue-700">
                {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : plan === 'premium' ? "Plan Actual" : "Seleccionar"}
              </Button>
            </CardContent>
          </Card>

          {/* Plan Empresarial */}
          <Card className="bg-black/30 border-white/10">
            <CardHeader>
              <CardTitle className="text-white">Empresarial</CardTitle>
              <CardDescription className="text-gray-400">Para equipos</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white mb-4">Personalizado</div>
              <ul className="space-y-2 mb-6 text-sm">
                <li className="flex items-center text-gray-300"><span className="w-2 h-2 bg-purple-500 rounded-full mr-2"></span>Todo lo de Premium</li>
                <li className="flex items-center text-gray-300"><span className="w-2 h-2 bg-purple-500 rounded-full mr-2"></span>Integraciones a medida</li>
                <li className="flex items-center text-gray-300"><span className="w-2 h-2 bg-purple-500 rounded-full mr-2"></span>Asistencia dedicada</li>
              </ul>
              <Button variant="outline" className="w-full" disabled>Contactar</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Billing;