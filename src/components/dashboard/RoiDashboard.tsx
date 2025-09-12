import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageSquare, Clock, DollarSign, Target, ShieldCheck } from "lucide-react";
import { motion, Variants } from "framer-motion";
import { showError } from "@/utils/toast";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AnalyticsChart } from "./AnalyticsChart";

interface RoiData {
  totalConversations: number;
  totalConversions: number;
  timeSavedMinutes: number;
  costSavedUSD: number;
  autonomousResolutionRate: number;
  activity: { date: string; conversations: number; conversions: number }[];
}

const StatCard = ({ title, value, icon, tooltipText }: { title: string; value: string | number; icon: React.ReactNode; tooltipText: string }) => (
  <Card className="bg-black/30 border-white/10 text-white h-full">
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

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.1,
      duration: 0.4,
      ease: "easeOut",
    },
  }),
};

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
        <Skeleton className="h-40 w-full mb-4" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <Skeleton className="h-80 w-full" />
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
      initial="hidden"
      animate="visible"
      transition={{ staggerChildren: 0.1 }}
      className="w-full max-w-4xl space-y-6"
    >
      <div>
        <h2 className="text-xl font-semibold text-white mb-4">Panel de ROI (Retorno de Inversión)</h2>
        
        <motion.div custom={0} variants={cardVariants} className="mb-6">
          <Card className="bg-gradient-to-br from-blue-900/50 to-purple-900/50 border-blue-500/30 p-6">
            <CardHeader className="p-0 mb-4">
              <CardTitle className="text-lg font-semibold text-white flex items-center gap-2">
                <ShieldCheck className="w-6 h-6 text-blue-300" />
                Métrica Clave: Tasa de Resolución Autónoma
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="text-center md:text-left">
                <p className="text-5xl font-bold text-white">{stats.autonomousResolutionRate}%</p>
                <p className="text-blue-200">de las conversaciones se resuelven 100% en automático.</p>
              </div>
              <p className="text-gray-300 max-w-md text-center md:text-right text-sm">
                Este es el porcentaje de interacciones que resultaron en una conversión exitosa (ej. una cita agendada) sin necesidad de que intervenga una persona.
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <motion.div custom={1} variants={cardVariants}>
            <StatCard 
              title="Conversaciones" 
              value={stats.totalConversations} 
              icon={<MessageSquare className="h-5 w-5 text-gray-400" />}
              tooltipText="Número total de conversaciones que tus agentes han gestionado."
            />
          </motion.div>
          <motion.div custom={2} variants={cardVariants}>
            <StatCard 
              title="Conversiones" 
              value={stats.totalConversions} 
              icon={<Target className="h-5 w-5 text-gray-400" />}
              tooltipText="Número de acciones de negocio valiosas completadas por tus agentes, como agendar una cita. Este es un seguimiento preciso, no una estimación."
            />
          </motion.div>
          <motion.div custom={3} variants={cardVariants}>
            <StatCard 
              title="Tiempo Ahorrado" 
              value={`${stats.timeSavedMinutes} min`} 
              icon={<Clock className="h-5 w-5 text-gray-400" />}
              tooltipText="Estimación de tiempo ahorrado al automatizar respuestas. Calculado en base a 2.5 minutos por interacción."
            />
          </motion.div>
          <motion.div custom={4} variants={cardVariants}>
            <StatCard 
              title="Coste Ahorrado (USD)" 
              value={`$${stats.costSavedUSD}`} 
              icon={<DollarSign className="h-5 w-5 text-gray-400" />}
              tooltipText="Estimación del ahorro en costes de personal. Calculado en base a una tarifa promedio de $15/hora."
            />
          </motion.div>
        </div>
      </div>
      <motion.div variants={cardVariants} custom={5}>
        <AnalyticsChart data={stats.activity} />
      </motion.div>
    </motion.div>
  );
};