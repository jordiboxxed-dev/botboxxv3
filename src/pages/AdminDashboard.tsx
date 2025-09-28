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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Bot, MessageSquare, ArrowLeft, Clock, DollarSign, Building } from "lucide-react";
import { motion } from "framer-motion";
import { showError } from "@/utils/toast";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

interface UserStat {
  id: string;
  email: string;
  created_at: string;
  subscribed_at: string | null;
  agent_count: number;
  message_count: number;
  first_name: string | null;
  last_name: string | null;
  time_saved: number;
  cost_saved: number;
}

interface Agency {
  id: string;
  name: string;
  owner: UserStat;
  clients: UserStat[];
}

interface AnalyticsData {
  totalUsers: number;
  totalAgents: number;
  totalMessages: number;
  totalTimeSaved: number;
  totalCostSaved: number;
  agencies: Agency[];
  independentUsers: UserStat[];
}

const StatCard = ({ title, value, icon, valueClassName }: { title: string; value: string | number; icon: React.ReactNode; valueClassName?: string }) => (
  <Card className="bg-black/30 border-white/10 text-white">
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium text-gray-400">{title}</CardTitle>
      {icon}
    </CardHeader>
    <CardContent>
      <div className={cn("text-2xl font-bold", valueClassName)}>{value}</div>
    </CardContent>
  </Card>
);

const UserTable = ({ users, title }: { users: UserStat[], title?: string }) => (
  <Card className="bg-black/30 border-white/10 h-full">
    {title && (
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
    )}
    <CardContent className="p-0">
      <div className="overflow-x-auto custom-scrollbar">
        <Table>
          <TableHeader>
            <TableRow className="border-white/20 hover:bg-transparent">
              <TableHead className="text-gray-200">Nombre</TableHead>
              <TableHead className="text-gray-200">Email</TableHead>
              <TableHead className="text-gray-200">Registro</TableHead>
              <TableHead className="text-gray-200 text-right">Agentes</TableHead>
              <TableHead className="text-gray-200 text-right">Mensajes</TableHead>
              <TableHead className="text-gray-200 text-right">Tiempo Ahorrado</TableHead>
              <TableHead className="text-gray-200 text-right">Coste Ahorrado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => {
              const fullName = `${user.first_name || ''} ${user.last_name || ''}`.trim();
              return (
                <TableRow key={user.id} className="border-white/10">
                  <TableCell className="font-medium text-gray-100 whitespace-nowrap">{fullName || 'N/A'}</TableCell>
                  <TableCell className="text-gray-300">{user.email}</TableCell>
                  <TableCell className="text-gray-300 whitespace-nowrap">{format(new Date(user.created_at), "d MMM, yyyy", { locale: es })}</TableCell>
                  <TableCell className="text-right text-gray-300">{user.agent_count}</TableCell>
                  <TableCell className="text-right text-gray-300">{user.message_count}</TableCell>
                  <TableCell className="text-right text-green-400">{user.time_saved} min</TableCell>
                  <TableCell className="text-right text-green-400">${user.cost_saved}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
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
          <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
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
          className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 mb-8"
        >
          <StatCard title="Total de Usuarios" value={data.totalUsers} icon={<Users className="h-4 w-4 text-gray-400" />} />
          <StatCard title="Total de Agentes" value={data.totalAgents} icon={<Bot className="h-4 w-4 text-gray-400" />} />
          <StatCard title="Total de Mensajes" value={data.totalMessages} icon={<MessageSquare className="h-4 w-4 text-gray-400" />} />
          <StatCard title="Tiempo Ahorrado" value={`${data.totalTimeSaved} min`} icon={<Clock className="h-4 w-4 text-green-400" />} valueClassName="text-green-400" />
          <StatCard title="Coste Ahorrado (USD)" value={`$${data.totalCostSaved}`} icon={<DollarSign className="h-4 w-4 text-green-400" />} valueClassName="text-green-400" />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="space-y-8"
        >
          {data.agencies.length > 0 && (
            <div>
              <h2 className="text-2xl font-bold mb-4">Agencias</h2>
              <Accordion type="single" collapsible className="w-full space-y-4">
                {data.agencies.map((agency) => (
                  <AccordionItem key={agency.id} value={agency.id} className="bg-black/30 border border-white/10 rounded-lg">
                    <AccordionTrigger className="px-6 py-4 hover:no-underline">
                      <div className="flex items-center gap-4">
                        <Building className="w-6 h-6 text-purple-400" />
                        <div>
                          <p className="font-semibold text-lg text-left">{agency.name}</p>
                          <p className="text-sm text-gray-400 text-left">Dueño: {agency.owner.first_name} {agency.owner.last_name}</p>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-6 pb-6">
                      <h3 className="text-md font-semibold mb-2 text-gray-300">Clientes de la Agencia</h3>
                      {agency.clients.length > 0 ? (
                        <UserTable users={agency.clients} />
                      ) : (
                        <p className="text-sm text-gray-500">Esta agencia no tiene clientes.</p>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          )}

          {data.independentUsers.length > 0 && (
            <div>
              <h2 className="text-2xl font-bold mb-4">Usuarios Independientes</h2>
              <UserTable users={data.independentUsers} />
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default AdminDashboard;