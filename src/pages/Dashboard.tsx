import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Bot, PlusCircle, LogOut, UserCog } from "lucide-react";
import { motion } from "framer-motion";
import { AnalyticsDashboard } from "@/components/dashboard/AnalyticsDashboard";
import { supabase } from "@/integrations/supabase/client";
import { OnboardingGuide } from "@/components/dashboard/OnboardingGuide";
import { Skeleton } from "@/components/ui/skeleton";
import { useUsage } from "@/hooks/useUsage";
import { PlanUsageBanner } from "@/components/dashboard/PlanUsageBanner";

const Dashboard = () => {
  const { usageInfo, isLoading: isLoadingUsage } = useUsage();

  if (isLoadingUsage) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900 p-4">
        <div className="w-full max-w-4xl space-y-8">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  const hasAgents = (usageInfo?.agentsCreated ?? 0) > 0;
  const agentLimitReached = usageInfo?.hasReachedAgentLimit ?? false;

  return (
    <div className="min-h-screen flex flex-col items-center bg-gray-900 text-white p-4 pt-8">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center mb-8 w-full max-w-4xl"
      >
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="text-left">
            <h1 className="text-4xl font-bold mb-2">BotBoxx Agents Hub</h1>
            <p className="text-lg text-gray-400">Gestiona y crea tus agentes de IA.</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Link to="/account">
              <Button variant="secondary">
                <UserCog className="w-4 h-4 mr-2" />
                Mi Cuenta
              </Button>
            </Link>
            <Button variant="secondary" onClick={() => supabase.auth.signOut()}>
              <LogOut className="w-4 h-4 mr-2" />
              Cerrar Sesión
            </Button>
          </div>
        </div>
      </motion.div>

      <div className="mb-8 w-full max-w-4xl">
        <PlanUsageBanner />
      </div>

      {!hasAgents ? (
        <OnboardingGuide />
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl w-full">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <Link to="/templates" className="block h-full">
                <div className="bg-black/30 p-8 rounded-xl border border-white/10 hover:border-blue-400 transition-all duration-300 flex flex-col items-center text-center h-full">
                  <Bot className="w-16 h-16 mb-4 text-blue-400" />
                  <h2 className="text-2xl font-semibold mb-2">Ver Agentes y Plantillas</h2>
                  <p className="text-gray-400 mb-6">Explora plantillas pre-configuradas o gestiona los agentes que ya has creado.</p>
                  <Button className="mt-auto">Explorar</Button>
                </div>
              </Link>
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
            >
              <div className="h-full relative">
                <Link to="/create-agent" className={`block h-full ${agentLimitReached ? 'pointer-events-none' : ''}`}>
                  <div className={`bg-black/30 p-8 rounded-xl border border-white/10  transition-all duration-300 flex flex-col items-center text-center h-full ${agentLimitReached ? 'opacity-50' : 'hover:border-green-400'}`}>
                    <PlusCircle className="w-16 h-16 mb-4 text-green-400" />
                    <h2 className="text-2xl font-semibold mb-2">Crear desde Cero</h2>
                    <p className="text-gray-400 mb-6">Diseña un agente personalizado con su propia personalidad y conocimiento.</p>
                    <Button variant="secondary" className="mt-auto" disabled={agentLimitReached}>Crear Agente</Button>
                  </div>
                </Link>
                {agentLimitReached && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <p className="text-center bg-black/80 p-2 rounded-md text-sm">Límite de agentes alcanzado.</p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>

          <div className="w-full max-w-4xl mt-8">
            <div className="my-6 border-t border-white/10"></div>
          </div>

          <AnalyticsDashboard />
        </>
      )}
    </div>
  );
};

export default Dashboard;