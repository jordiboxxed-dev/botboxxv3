import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { showError } from "@/utils/toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { PlusCircle, MoreHorizontal, User } from "lucide-react";
import { CreateClientDialog } from "@/components/agency/CreateClientDialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

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
                        <Table>
                            <TableHeader>
                                <TableRow className="border-white/20 hover:bg-transparent">
                                    <TableHead className="text-gray-200">Nombre</TableHead>
                                    <TableHead className="text-gray-200">Email</TableHead>
                                    <TableHead className="text-gray-200 text-center">Agentes</TableHead>
                                    <TableHead className="text-right"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {clients.length > 0 ? clients.map((client) => (
                                    <TableRow key={client.id} className="border-white/10">
                                        <TableCell className="font-medium text-gray-100">{client.first_name} {client.last_name}</TableCell>
                                        <TableCell className="text-gray-300">{client.email}</TableCell>
                                        <TableCell className="text-center text-gray-300">{client.agent_count}</TableCell>
                                        <TableCell className="text-right">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon"><MoreHorizontal className="w-4 h-4" /></Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent>
                                                    <DropdownMenuItem disabled>Gestionar Agentes</DropdownMenuItem>
                                                    <DropdownMenuItem disabled>Eliminar Cliente</DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
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