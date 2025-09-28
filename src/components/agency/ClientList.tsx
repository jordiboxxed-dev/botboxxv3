import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { showError, showSuccess } from "@/utils/toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { PlusCircle, User, Trash2, LogIn, Loader2 } from "lucide-react";
import { CreateClientDialog } from "@/components/agency/CreateClientDialog";
import { useNavigate } from "react-router-dom";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface Client {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    agent_count: number;
}

export const ClientList = () => {
    const [clients, setClients] = useState<Client[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const [impersonatingId, setImpersonatingId] = useState<string | null>(null);
    const navigate = useNavigate();

    const fetchClients = useCallback(async () => {
        setIsLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("Usuario no autenticado.");

            const { data: ownerProfile, error: profileError } = await supabase.from('profiles').select('agency_id').eq('id', user.id).single();
            if (profileError || !ownerProfile?.agency_id) throw new Error("No se pudo encontrar la información de la agencia.");
            
            const { agency_id } = ownerProfile;

            const { data: clientProfiles, error: clientsError } = await supabase.from('profiles').select('id, first_name, last_name, email').eq('agency_id', agency_id).eq('role', 'client');
            if (clientsError) throw clientsError;

            const clientsWithAgentCounts = await Promise.all(
                clientProfiles.map(async (client) => {
                    const { count, error: countError } = await supabase.from('agents').select('*', { count: 'exact', head: true }).eq('user_id', client.id).is('deleted_at', null);
                    if (countError) console.error(`Error fetching agent count for ${client.id}:`, countError);
                    return { ...client, agent_count: count || 0 };
                })
            );

            setClients(clientsWithAgentCounts);
        } catch (error) {
            showError("Error al cargar los clientes: " + (error as Error).message);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchClients();
    }, [fetchClients]);

    const handleImpersonate = async (client: Client) => {
        setImpersonatingId(client.id);
        try {
            const { data: currentSessionData, error: sessionError } = await supabase.auth.getSession();
            if (sessionError || !currentSessionData.session) {
                throw new Error("No se pudo obtener la sesión actual.");
            }
            
            localStorage.setItem('dyad_impersonation_original_session', JSON.stringify(currentSessionData.session));

            const { data, error } = await supabase.functions.invoke('impersonate-client', {
                headers: {
                    Authorization: `Bearer ${currentSessionData.session.access_token}`,
                },
                body: { clientId: client.id }
            });

            if (error) throw error;
            if (data.error) throw new Error(data.error);

            const { access_token, refresh_token } = data;
            const { error: setSessionError } = await supabase.auth.setSession({ access_token, refresh_token });
            if (setSessionError) throw setSessionError;

            showSuccess(`Iniciando sesión como ${client.first_name}. Serás redirigido.`);
            
            window.location.href = '/dashboard';

        } catch (error) {
            showError("Error al iniciar sesión como cliente: " + (error as Error).message);
            localStorage.removeItem('dyad_impersonation_original_session');
        } finally {
            setImpersonatingId(null);
        }
    };

    const handleDeleteClient = async (clientId: string) => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error("Sesión no encontrada.");

            const { error } = await supabase.functions.invoke('delete-agency-client', {
                headers: {
                    Authorization: `Bearer ${session.access_token}`,
                },
                body: { clientId }
            });
            if (error) throw error;
            showSuccess("Cliente eliminado correctamente.");
            fetchClients(); // Refresh the list
        } catch (error) {
            showError("Error al eliminar el cliente: " + (error as Error).message);
        }
    };

    return (
        <>
            <Card className="bg-black/30 border-white/10">
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>Clientes</CardTitle>
                        <CardDescription>Lista de todos los clientes de tu agencia.</CardDescription>
                    </div>
                    <Button onClick={() => setIsCreateDialogOpen(true)}>
                        <PlusCircle className="w-4 h-4 mr-2" />
                        Crear Cliente
                    </Button>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="space-y-2">
                            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
                        </div>
                    ) : (
                        <div className="border border-white/10 rounded-lg">
                            <Table>
                                <TableHeader>
                                    <TableRow className="border-b-white/10 hover:bg-transparent">
                                        <TableHead className="text-gray-200">Nombre</TableHead>
                                        <TableHead className="text-gray-200">Email</TableHead>
                                        <TableHead className="text-gray-200 text-center">Agentes</TableHead>
                                        <TableHead className="text-right text-gray-200">Acciones</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {clients.length > 0 ? clients.map((client) => (
                                        <TableRow 
                                            key={client.id} 
                                            className="border-t-white/10"
                                        >
                                            <TableCell 
                                                className="font-medium text-gray-100 cursor-pointer hover:underline"
                                                onClick={() => navigate(`/agency/client/${client.id}`)}
                                            >
                                                {client.first_name} {client.last_name}
                                            </TableCell>
                                            <TableCell className="text-gray-300">{client.email}</TableCell>
                                            <TableCell className="text-center text-gray-300">{client.agent_count}</TableCell>
                                            <TableCell className="text-right space-x-2">
                                                <Button 
                                                    variant="ghost" 
                                                    size="sm"
                                                    disabled={impersonatingId === client.id}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleImpersonate(client);
                                                    }}
                                                >
                                                    {impersonatingId === client.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <><LogIn className="w-4 h-4 mr-2" /> Administrar</>}
                                                </Button>
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <Button 
                                                            variant="ghost" 
                                                            size="icon" 
                                                            className="text-gray-400 hover:text-red-500"
                                                            onClick={(e) => e.stopPropagation()}
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </Button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle>¿Eliminar a {client.first_name}?</AlertDialogTitle>
                                                            <AlertDialogDescription>
                                                                Esta acción es permanente. Se eliminará el usuario del cliente y todos sus agentes y datos asociados. Esta acción no se puede deshacer.
                                                            </AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel onClick={(e) => e.stopPropagation()}>Cancelar</AlertDialogCancel>
                                                            <AlertDialogAction 
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleDeleteClient(client.id);
                                                                }}
                                                                className="bg-red-600 hover:bg-red-700"
                                                            >
                                                                Eliminar Cliente
                                                            </AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            </TableCell>
                                        </TableRow>
                                    )) : (
                                        <TableRow>
                                            <TableCell colSpan={4} className="text-center text-gray-500 py-8">
                                                <User className="mx-auto w-12 h-12 mb-4" />
                                                Aún no has creado ningún cliente.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>
            <CreateClientDialog
                open={isCreateDialogOpen}
                onOpenChange={setIsCreateDialogOpen}
                onClientCreated={fetchClients}
            />
        </>
    );
};