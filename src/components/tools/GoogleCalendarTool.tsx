import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { showError, showSuccess } from "@/utils/toast";
import { Calendar, CheckCircle, Link, Loader2, XCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export const GoogleCalendarTool = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  const checkConnection = async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsConnected(false);
        setIsLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("user_credentials")
        .select("service")
        .eq("user_id", user.id)
        .eq("service", "google_calendar")
        .maybeSingle();

      if (error) throw error;
      
      setIsConnected(!!data);

    } catch (err) {
      console.error("Error checking Google connection:", err);
      showError("No se pudo comprobar la conexión con Google Calendar.");
      setIsConnected(false);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkConnection();
  }, []);

  const handleConnect = async () => {
    setIsProcessing(true);
    try {
      // Simplificamos la llamada a la función. `supabase-js` se encarga de la autenticación.
      const { data, error } = await supabase.functions.invoke('google-auth-start');

      if (error) {
        throw error;
      }

      if (!data || !data.authUrl) {
        throw new Error("La respuesta del servidor no contenía una URL de autenticación.");
      }

      window.location.href = data.authUrl;

    } catch (error) {
      console.error("Frontend error during connect:", error);
      showError("Error al iniciar la conexión: " + (error as Error).message);
      setIsProcessing(false);
    }
  };

  const handleDisconnect = async () => {
    setIsProcessing(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setIsProcessing(false);
      return;
    }

    const { error } = await supabase
      .from("user_credentials")
      .delete()
      .eq("user_id", user.id)
      .eq("service", "google_calendar");

    if (error) {
      showError("Error al desconectar: " + error.message);
    } else {
      showSuccess("Google Calendar desconectado.");
      setIsConnected(false);
    }
    setIsProcessing(false);
  };

  if (isLoading) {
    return <Skeleton className="h-24 w-full" />;
  }

  return (
    <div className="bg-black/30 p-4 rounded-lg border border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
      <div className="flex items-center gap-4">
        <div className="p-2 bg-white/10 rounded-md flex-shrink-0">
          <Calendar className="w-6 h-6 text-red-400" />
        </div>
        <div>
          <h4 className="font-semibold text-white">Google Calendar</h4>
          <p className="text-sm text-gray-400">
            {isConnected 
              ? "Permite al agente leer tus eventos y crear nuevos."
              : "Conecta tu calendario para que el agente pueda agendar reuniones."
            }
          </p>
        </div>
      </div>
      <div className="flex-shrink-0 self-end sm:self-center">
        {isConnected ? (
          <div className="flex items-center gap-2">
            <span className="text-sm text-green-400 flex items-center gap-1"><CheckCircle className="w-4 h-4" /> Conectado</span>
            <Button variant="destructive" size="sm" onClick={handleDisconnect} disabled={isProcessing} title="Desconectar Google Calendar">
              {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
            </Button>
          </div>
        ) : (
          <Button onClick={handleConnect} disabled={isProcessing}>
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Conectando...
              </>
            ) : (
              <>
                <Link className="w-4 h-4 mr-2" />
                Conectar
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
};