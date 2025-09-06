import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Bot, MessageSquare, TrendingUp } from "lucide-react";
import { motion } from "framer-motion";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
}

const StatCard = ({ title, value, icon }: StatCardProps) => (
  <Card className="bg-black/30 border-white/10 text-white">
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium text-gray-400">{title}</CardTitle>
      {icon}
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold">{value}</div>
    </CardContent>
  </Card>
);

export const AnalyticsDashboard = () => {
  const [stats, setStats] = useState({
    totalAgents: 0,
    totalMessages: 0,
    mostActiveAgent: "N/A",
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      setIsLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsLoading(false);
        return;
      }

      const [agentsRes, messagesRes] = await Promise.all([
        supabase.from("agents").select("id, name").eq("user_id", user.id),
        supabase.from("messages").select("agent_id").eq("user_id", user.id),
      ]);

      const agents = agentsRes.data || [];
      const messages = messagesRes.data || [];

      let mostActiveAgent = "N/A";
      if (messages.length > 0 && agents.length > 0) {
        const messageCounts = messages.reduce((acc, msg) => {
          acc[msg.agent_id] = (acc[msg.agent_id] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        const mostActiveId = Object.keys(messageCounts).reduce((a, b) =>
          messageCounts[a] > messageCounts[b] ? a : b
        );
        
        const activeAgent = agents.find(agent => agent.id === mostActiveId);
        mostActiveAgent = activeAgent ? activeAgent.name : "N/A";
      }

      setStats({
        totalAgents: agents.length,
        totalMessages: messages.length,
        mostActiveAgent,
      });

      setIsLoading(false);
    };

    fetchAnalytics();
  }, []);

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-3 w-full max-w-4xl">
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1 }}
      className="w-full max-w-4xl"
    >
      <h2 className="text-xl font-semibold text-white mb-4">Resumen de Actividad</h2>
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          title="Agentes Creados"
          value={stats.totalAgents}
          icon={<Bot className="h-4 w-4 text-gray-400" />}
        />
        <StatCard
          title="Total de Mensajes"
          value={stats.totalMessages}
          icon={<MessageSquare className="h-4 w-4 text-gray-400" />}
        />
        <StatCard
          title="Agente más Activo"
          value={stats.mostActiveAgent}
          icon={<TrendingUp className="h-4 w-4 text-gray-400" />}
        />
      </div>
    </motion.div>
  );
};