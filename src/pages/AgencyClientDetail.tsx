import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { showError } from "@/utils/toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Bot, Eye } from "lucide-react";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface ClientProfile {
    first_name: string | null;
    last_name: string | null;
    email: string | null;
}

interface Agent {
    id: string;
    name: string;
    status: string;
    description: string | null;
}

const AgencyClientDetail = () => {
    const { clientId } = useParams<{ clientId: string }>();
    const navigate = useNavigate();
    const [client, setClient] = useState<ClientProfile | null>(null);
    const [agents, setAgents] = useState<Agent[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            if (!clientId) {
                navigate('/agency');
                return;
            }
            setIsLoading(true);
            try {
                // Fetch client profile
                const { data: profileData, error: profileError } = await supabase
                    .from('profiles')
                    .select('first_name, last_name, email')
                    .eq('id', clientId)
                    .single();
                
                if (profileError) throw profileError;
                setClient(profileData);

                // Fetch client's agents
                const { data: agentsData, error: agentsError } = await supabase
                    .from('agents')
                    .select('id, name, status, description')
                    .eq('user_id', clientId)
                    .is('deleted_at', null);

                if (agentsError) throw agentsError;
                setAgents(agentsData);

            } catch (error) {
                showError("Error al cargar los datos del cliente: " + (error as Error).message);
                navigate('/agency');
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, [clientId, navigate]);

    if (isLoading) {
        return (
            <div className="min-h-screen bg-gray-900 p-4 md:p-8 text-white">
                <div className="max-w-7xl mx-auto">
                    <Skeleton className="h-10 w-48 mb-8" />
                    <Skeleton className="h-24 w-full mb-6" />
                    <Skeleton className="h-64 w-full" />
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-900 p-4 md:p-8 text-white">
            <div className="max-w-7xl mx-auto">
                <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
                    <Button variant="outline" onClick={() => navigate('/agency')} className="text-white border-white/30 hover:bg-white/10 mb-6">
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Volver a Clientes
                    </Button>
                    <Card className="bg-black/30 border-white/10 mb-6">
                        <CardHeader>
                            <CardTitle className="text-2xl">{client?.first_name} {client?.last_name}</CardTitle>
                            <CardDescription>{client?.email}</CardDescription>
                        </CardHeader>
                    </Card>
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                    <Card className="bg-black/30 border-white/10">
                        <CardHeader>
                            <CardTitle>Agentes del Cliente</CardTitle>
                            <CardDescription>Estos son los agentes creados por {client?.first_name}.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="border border-white/10 rounded-lg">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="border-b-white/10 hover:bg-transparent">
                                            <TableHead className="text-gray-200">Nombre del Agente</TableHead>
                                            <TableHead className="text-gray-200">Estado</TableHead>
                                            <TableHead className="text-right"></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {agents.length > 0 ? agents.map((agent) => (
                                            <TableRow key={agent.id} className="border-t-white/10">
                                                <TableCell className="font-medium text-gray-100">{agent.name}</TableCell>
                                                <TableCell>
                                                    <Badge variant={agent.status === 'active' ? 'default' : 'secondary'} className={cn('flex-shrink-0', agent.status === 'active' ? 'bg-green-500/20 text-green-300 border-green-500/30' : 'bg-gray-500/20 text-gray-300 border-gray-500/30')}>
                                                        {agent.status === 'active' ? 'Activo' : 'Inactivo'}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <Button asChild variant="ghost" size="sm">
                                                        <Link to={`/agent/${agent.id}`}>
                                                            <Eye className="w-4 h-4 mr-2" />
                                                            Ver Agente
                                                        </Link>
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        )) : (
                                            <TableRow>
                                                <TableCell colSpan={3} className="text-center text-gray-500 py-8">
                                                    <Bot className="mx-auto w-12 h-12 mb-4" />
                                                    Este cliente aún no ha creado ningún agente.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>
            </div>
        </div>
    );
};

export default AgencyClientDetail;