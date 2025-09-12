import { useState, useEffect } from "react";
import { supabase, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "@/integrations/supabase/client";
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
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setIsLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("user_credentials")
      .select("id")
      .eq("user_id", user.id)
      .eq("service", "google_calendar")
      .maybeSingle(); // maybeSingle es más robusto si no hay resultados

    if (data && !error) {
      setIsConnected(true);
    } else {
      setIsConnected(false);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    checkConnection();
  }, []);

  const handleConnect = async () => {
    setIsProcessing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No estás autenticado.");

      console.log("Fetching auth URL from backend...");
      const response = await fetch(`${SUPABASE_URL}/functions/v1/google-auth-start`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': SUPABASE_PUBLISHABLE_KEY,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Backend error response:", errorData);
        throw new Error(errorData.error || `Error del servidor: ${response.statusText}`);
      }

      const { authUrl } = await response.json();
      if (!authUrl) {
        throw new Error("La respuesta del servidor no contenía una URL de autenticación.");
      }

      console.log("Redirecting to Google Auth URL...");
      window.location.href = authUrl;

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
    <div className="bg-black/30 p-4 rounded-lg border border-white/10 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <div className="p-2 bg-white/10 rounded-md">
          <Calendar className="w-6 h-6 text-red-400" />
        </div>
        <div>
          <h4 className="font-semibold text-white">Google Calendar</h4>
          <p className="text-sm text-gray-400">Permite al agente leer tus eventos próximos.</p>
        </div>
      </div>
      <div>
        {isConnected ? (
          <div className="flex items-center gap-2">
            <span className="text-sm text-green-400 flex items-center gap-1"><CheckCircle className="w-4 h-4" /> Conectado</span>
            <Button variant="destructive" size="sm" onClick={handleDisconnect} disabled={isProcessing}>
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