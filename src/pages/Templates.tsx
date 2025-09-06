import { useState, useEffect, ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AgentCard } from "@/components/agents/AgentCard";
import { mockAgents } from "@/data/mock-agents";
import { showError, showSuccess } from "@/utils/toast";
import { Plus, ArrowLeft, Bot, Trash2 } from "lucide-react";
import { motion } from "framer-motion";
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
import { useInteractiveCard } from "@/hooks/useInteractiveCard";
import { cn } from "@/lib/utils";
import React from "react";

const Templates = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [userAgents, setUserAgents] = useState<any[]>([]);

  const fetchUserAgents = async () => {
    setIsLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      navigate('/login');
      return;
    }

    const { data, error } = await supabase
      .from('agents')
      .select('*')
      .eq('user_id', user.id);

    if (error) {
      console.error("Error fetching agents:", error);
      showError("Error al cargar los agentes.");
    } else {
      setUserAgents(data || []);
    }
    
    setIsLoading(false);
  };

  useEffect(() => {
    fetchUserAgents();
  }, [navigate]);

  const handleCreateFromTemplate = async (template: any) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        showError("Debes iniciar sesión para crear un agente.");
        return;
      }

      const { data, error } = await supabase
        .from("agents")
        .insert({
          user_id: user.id,
          name: `Copia de ${template.name}`,
          description: template.description,
          system_prompt: template.systemPrompt,
        })
        .select()
        .single();

      if (error) throw error;

      showSuccess("¡Agente creado desde plantilla!");
      navigate(`/agent/${data.id}`);
    } catch (error) {
      console.error("Error creating agent from template:", error);
      showError("Error al crear el agente desde la plantilla.");
    }
  };

  const handleDeleteAgent = async (agentId: string) => {
    const { error } = await supabase.from('agents').delete().eq('id', agentId);
    if (error) {
      showError("Error al eliminar el agente: " + error.message);
    } else {
      showSuccess("Agente eliminado correctamente.");
      fetchUserAgents(); // Re-fetch agents to update the list
    }
  };

  const cardProps = useInteractiveCard();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 p-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <Skeleton className="h-10 w-64" />
            <Skeleton className="h-10 w-32" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-black/30 rounded-xl p-6 border border-white/10">
                <Skeleton className="h-16 w-16 rounded-md mb-4" />
                <Skeleton className="h-6 w-3/4 mb-2" />
                <Skeleton className="h-4 w-full mb-4" />
                <Skeleton className="h-10 w-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 p-8">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-8"
        >
          <div>
            <h1 className="text-3xl font-bold text-white">Plantillas de Agentes</h1>
            <p className="text-gray-400">Selecciona una plantilla para crear tu agente personalizado</p>
          </div>
          <Button onClick={() => navigate('/create-agent')} variant="outline" className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Crear desde cero
          </Button>
        </motion.div>

        <div className="mb-10">
          <h2 className="text-xl font-semibold text-white mb-4">Tus Agentes Creados</h2>
          {userAgents.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {userAgents.map((agent, index) => (
                <motion.div
                  {...cardProps}
                  ref={cardProps.ref as React.Ref<HTMLDivElement>}
                  key={agent.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.1 }}
                  className={cn(cardProps.className, "bg-black/30 rounded-xl p-4 border border-white/10 hover:border-blue-400 transition-all duration-200 flex items-center justify-between")}
                >
                  <Link to={`/agent/${agent.id}`} className="flex-grow">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-white/10 rounded-md">
                        <Bot className="w-6 h-6 text-gray-300" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-white">{agent.name}</h3>
                        <p className="text-sm text-gray-400 line-clamp-1">{agent.description || 'Sin descripción'}</p>
                      </div>
                    </div>
                  </Link>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-red-500 flex-shrink-0 ml-2">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Esta acción eliminará permanentemente el agente "{agent.name}" y todos sus datos asociados.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDeleteAgent(agent.id)} className="bg-red-600 hover:bg-red-700">
                          Eliminar
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="bg-black/30 rounded-xl p-8 text-center border border-white/10">
              <p className="text-gray-400 mb-4">Aún no has creado ningún agente</p>
              <Button onClick={() => navigate('/create-agent')}>
                Crear tu primer agente
              </Button>
            </div>
          )}
        </div>

        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-white">Plantillas Disponibles</h2>
          <Button variant="ghost" onClick={() => navigate('/dashboard')} className="flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" />
            Volver al inicio
          </Button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {mockAgents.map((agent, index) => (
            <motion.div
              {...cardProps}
              ref={cardProps.ref as React.Ref<HTMLDivElement>}
              key={agent.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
              className={cn(cardProps.className, "bg-black/30 rounded-xl p-6 border border-white/10 hover:border-blue-400 transition-all duration-200 h-full flex flex-col")}
            >
              <AgentCard 
                agent={agent} 
                onClick={() => {}} 
                index={index} 
                isInteractive={false}
              />
              <p className="text-gray-400 text-sm mt-4 mb-6 flex-grow">{agent.description}</p>
              <Button 
                onClick={() => handleCreateFromTemplate(agent)}
                className="w-full"
              >
                Usar esta plantilla
              </Button>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Templates;