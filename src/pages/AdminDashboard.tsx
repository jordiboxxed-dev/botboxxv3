import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Bot, MessageSquare, ArrowLeft, Star } from "lucide-react";
import { motion } from "framer-motion";
import { showError } from "@/utils/toast";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface UserStat {
  id: string;
  email: string;
  created_at: string;
  subscribed_at: string | null;
  agent_count: number;
  message_count: number;
}

interface AnalyticsData {
  totalUsers: number;
  totalAgents: number;
  totalMessages: number;
  usersWithStats: UserStat[];
}

const StatCard = ({ title, value, icon }: { title: string; value: number; icon: React.ReactNode }) => (
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

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      setIsLoading(true);
      try {
        const { data: responseData, error } = await supabase.functions.invoke("get-admin-analytics");
        if (error) throw error;
        if (responseData.error) throw new Error(responseData.error);
        setData(responseData);
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
      <div className="min-h-screen bg-gray-900 p-8">
        <div className="max-w-7xl mx-auto space-y-8">
          <Skeleton className="h-10 w-64" />
          <div className="grid gap-4 md:grid-cols-3">
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
          </div>
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  if (!data) {
    return <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">Error al cargar los datos.</div>;
  }

  const subscribedUsers = data.usersWithStats
    .filter(user => user.subscribed_at)
    .sort((a, b) => new Date(b.subscribed_at!).getTime() - new Date(a.subscribed_at!).getTime());

  return (
    <div className="min-h-screen bg-gray-900 p-4 md:p-8 text-white">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-8"
        >
          <div>
            <h1 className="text-3xl font-bold">Panel de Administrador</h1>
            <p className="text-gray-400">Vista general de la plataforma.</p>
          </div>
          <Button variant="outline" onClick={() => navigate('/dashboard')} className="text-white border-white/30 hover:bg-white/10">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver al Dashboard
          </Button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="grid gap-4 md:grid-cols-3 mb-8"
        >
          <StatCard title="Total de Usuarios" value={data.totalUsers} icon={<Users className="h-4 w-4 text-gray-400" />} />
          <StatCard title="Total de Agentes" value={data.totalAgents} icon={<Bot className="h-4 w-4 text-gray-400" />} />
          <StatCard title="Total de Mensajes" value={data.totalMessages} icon={<MessageSquare className="h-4 w-4 text-gray-400" />} />
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card className="bg-black/30 border-white/10 h-full">
              <CardHeader>
                <CardTitle>Usuarios Registrados</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow className="border-white/20 hover:bg-transparent">
                      <TableHead className="text-gray-200">Email</TableHead>
                      <TableHead className="text-gray-200">Fecha de Registro</TableHead>
                      <TableHead className="text-gray-200 text-right">Agentes</TableHead>
                      <TableHead className="text-gray-200 text-right">Mensajes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.usersWithStats.map((user) => (
                      <TableRow key={user.id} className="border-white/10">
                        <TableCell className="font-medium text-gray-100">{user.email}</TableCell>
                        <TableCell className="text-gray-300">{format(new Date(user.created_at), "d MMM, yyyy", { locale: es })}</TableCell>
                        <TableCell className="text-right text-gray-300">{user.agent_count}</TableCell>
                        <TableCell className="text-right text-gray-300">{user.message_count}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            <Card className="bg-black/30 border-white/10 h-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Star className="w-5 h-5 text-yellow-400" />
                  Suscripciones Recientes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow className="border-white/20 hover:bg-transparent">
                      <TableHead className="text-gray-200">Email</TableHead>
                      <TableHead className="text-gray-200 text-right">Fecha de Suscripción</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {subscribedUsers.length > 0 ? (
                      subscribedUsers.map((user) => (
                        <TableRow key={user.id} className="border-white/10">
                          <TableCell className="font-medium text-gray-100">{user.email}</TableCell>
                          <TableCell className="text-right text-gray-300">
                            {format(new Date(user.subscribed_at!), "d MMM, yyyy HH:mm", { locale: es })}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={2} className="text-center text-gray-500 py-8">
                          No hay suscripciones recientes.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;