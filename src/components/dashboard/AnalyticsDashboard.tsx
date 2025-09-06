import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Bot, MessageSquare, TrendingUp } from "lucide-react";
import { motion } from "framer-motion";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

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
  const [chartData, setChartData] = useState<{ name: string; messages: number }[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      setIsLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsLoading(false);
        return;
      }

      // Contar todos los agentes, incluyendo los soft-deleted
      const { count: totalAgentsCount, error: agentsCountError } = await supabase
        .from("agents")
        .select('*', { count: 'exact', head: true })
        .eq("user_id", user.id);

      // Obtener solo los agentes activos para el gráfico y el más activo
      const [activeAgentsRes, messagesRes] = await Promise.all([
        supabase.from("agents").select("id, name").eq("user_id", user.id).is('deleted_at', null),
        supabase.from("messages").select("agent_id").eq("user_id", user.id),
      ]);

      const activeAgents = activeAgentsRes.data || [];
      const messages = messagesRes.data || [];

      const messageCounts = messages.reduce((acc, msg) => {
        acc[msg.agent_id] = (acc[msg.agent_id] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      let mostActiveAgent = "N/A";
      if (Object.keys(messageCounts).length > 0) {
        const mostActiveId = Object.keys(messageCounts).reduce((a, b) =>
          messageCounts[a] > messageCounts[b] ? a : b
        );
        const activeAgent = activeAgents.find(agent => agent.id === mostActiveId);
        mostActiveAgent = activeAgent ? activeAgent.name : "N/A";
      }

      setStats({
        totalAgents: totalAgentsCount || 0,
        totalMessages: messages.length,
        mostActiveAgent,
      });

      const newChartData = activeAgents.map(agent => ({
        name: agent.name.split(' ').slice(0, 2).join(' '), // Shorten name for chart
        messages: messageCounts[agent.id] || 0,
      }));
      setChartData(newChartData);

      setIsLoading(false);
    };

    fetchAnalytics();
  }, []);

  if (isLoading) {
    return (
      <div className="w-full max-w-4xl space-y-4">
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
        <Skeleton className="h-72" />
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
        <h2 className="text-xl font-semibold text-white mb-4">Resumen de Actividad</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <StatCard title="Agentes Creados (Total)" value={stats.totalAgents} icon={<Bot className="h-4 w-4 text-gray-400" />} />
          <StatCard title="Total de Mensajes" value={stats.totalMessages} icon={<MessageSquare className="h-4 w-4 text-gray-400" />} />
          <StatCard title="Agente más Activo" value={stats.mostActiveAgent} icon={<TrendingUp className="h-4 w-4 text-gray-400" />} />
        </div>
      </div>

      <Card className="bg-black/30 border-white/10 text-white">
        <CardHeader>
          <CardTitle className="text-gray-300">Distribución de Mensajes por Agente (Activos)</CardTitle>
        </CardHeader>
        <CardContent>
          {chartData.length > 0 ? (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                  <XAxis dataKey="name" stroke="#a1a1aa" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#a1a1aa" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip cursor={{ fill: 'rgba(100, 116, 139, 0.1)' }} contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', color: '#e5e7eb' }} />
                  <Bar dataKey="messages" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-72 flex items-center justify-center text-gray-500">
              No hay datos de mensajes para mostrar.
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
};