import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageSquare, Clock, DollarSign, Target } from "lucide-react";
import { motion } from "framer-motion";
import { showError } from "@/utils/toast";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface RoiData {
  totalConversations: number;
  leadsGenerated: number;
  timeSavedMinutes: number;
  costSavedUSD: number;
}

const StatCard = ({ title, value, icon, tooltipText }: { title: string; value: string | number; icon: React.ReactNode; tooltipText: string }) => (
  <Card className="bg-black/30 border-white/10 text-white">
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium text-gray-400">{title}</CardTitle>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="cursor-help">
              {icon}
            </span>
          </TooltipTrigger>
          <TooltipContent>
            <p className="max-w-xs">{tooltipText}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </CardHeader>
    <CardContent>
      <div className="text-3xl font-bold">{value}</div>
    </CardContent>
  </Card>
);

export const RoiDashboard = () => {
  const [stats, setStats] = useState<RoiData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke("get-user-analytics");
        if (error) throw error;
        if (data.error) throw new Error(data.error);
        setStats(data);
      } catch (err) {
        showError("No se pudieron cargar las analíticas: " + (err as Error).message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAnalytics();
  }, []);

  if (isLoading) {
    return (
      <div className="w-full max-w-4xl space-y-4">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      </div>
    );
  }

  if (!stats || stats.totalConversations === 0) {
    return (
      <div className="w-full max-w-4xl text-center bg-black/20 p-8 rounded-lg border border-white/10">
        <MessageSquare className="mx-auto h-12 w-12 text-gray-500 mb-4" />
        <h3 className="text-xl font-semibold text-white">Aún no hay datos de conversaciones</h3>
        <p className="text-gray-400 mt-2">
          Una vez que tus agentes empiecen a interactuar con los usuarios, aquí verás el valor que están generando.
        </p>
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1 }}
      className="w-full max-w-4xl space-y-6"
    >
      <div>
        <h2 className="text-xl font-semibold text-white mb-4">Panel de ROI (Retorno de Inversión)</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard 
            title="Conversaciones" 
            value={stats.totalConversations} 
            icon={<MessageSquare className="h-5 w-5 text-gray-400" />}
            tooltipText="Número total de conversaciones que tus agentes han gestionado."
          />
          <StatCard 
            title="Leads Capturados" 
            value={stats.leadsGenerated} 
            icon={<Target className="h-5 w-5 text-gray-400" />}
            tooltipText="Estimación de conversaciones donde el usuario mostró interés de compra o contacto, basado en palabras clave."
          />
          <StatCard 
            title="Tiempo Ahorrado" 
            value={`${stats.timeSavedMinutes} min`} 
            icon={<Clock className="h-5 w-5 text-gray-400" />}
            tooltipText="Estimación de tiempo ahorrado al automatizar respuestas. Calculado en base a 2.5 minutos por interacción."
          />
          <StatCard 
            title="Coste Ahorrado (USD)" 
            value={`$${stats.costSavedUSD}`} 
            icon={<DollarSign className="h-5 w-5 text-gray-400" />}
            tooltipText="Estimación del ahorro en costes de personal. Calculado en base a una tarifa promedio de $15/hora."
          />
        </div>
      </div>
    </motion.div>
  );
};