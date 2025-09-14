import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LogOut, Bot, Plus, LayoutTemplate, Trash2 } from "lucide-react";
import { motion } from "framer-motion";
import { AgentCard } from "@/components/agents/AgentCard";
import { Agent } from "./AppLayout";
import { Link, useNavigate } from "react-router-dom";
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
import { useUsage } from "@/hooks/useUsage";
import { cn } from "@/lib/utils";

interface SidebarProps {
  userAgents: Agent[];
  activeAgentId?: string;
  onDeleteAgent: (agentId: string) => void;
  onLinkClick?: () => void;
}

export const Sidebar = ({ userAgents, activeAgentId, onDeleteAgent, onLinkClick }: SidebarProps) => {
  const navigate = useNavigate();
  const { usageInfo } = useUsage();
  const agentLimitReached = usageInfo?.hasReachedAgentLimit ?? false;

  const handleNavigate = (path: string) => {
    if (path === '/create-agent' && agentLimitReached) {
      return;
    }
    navigate(path);
    onLinkClick?.();
  };

  return (
    <aside className="w-full h-full p-4 flex flex-col">
      <Link to="/dashboard" onClick={onLinkClick} className="flex items-center gap-3 mb-8">
        <Bot className="w-8 h-8 text-blue-400" />
        <h1 className="text-2xl font-bold text-white">Agentes IA</h1>
      </Link>
      
      <nav className="flex-1 flex flex-col gap-3 overflow-y-auto px-1">
        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.5 }}
          onClick={() => handleNavigate('/create-agent')}
          disabled={agentLimitReached}
          title={agentLimitReached ? "Has alcanzado el límite de agentes de tu plan" : "Crear un nuevo agente"}
          className={cn(
            "w-full text-left p-3 rounded-lg flex items-center gap-4 bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-400 border border-blue-500/30",
            agentLimitReached && "opacity-50 cursor-not-allowed"
          )}
        >
          <div className="p-2 bg-white/10 rounded-md">
            <Plus className="w-6 h-6" />
          </div>
          <div>
            <p className="font-semibold">Crear Agente</p>
            <p className="text-sm text-blue-400">{agentLimitReached ? "Límite alcanzado" : "Empezar desde cero"}</p>
          </div>
        </motion.button>

        <div className="my-2 border-t border-white/10"></div>
        <div className="flex justify-between items-center px-2 mb-2">
          <h2 className="text-sm font-semibold text-gray-400">Mis Agentes</h2>
        </div>
        
        {userAgents.length > 0 ? userAgents.map((agent, index) => (
          <div key={agent.id} className={`flex items-center gap-2 rounded-xl ${agent.id === activeAgentId ? 'ring-2 ring-blue-400' : ''}`}>
            <Link to={`/agent/${agent.id}`} onClick={onLinkClick} className="flex-1 min-w-0">
              <AgentCard 
                agent={{
                  ...agent,
                  description: agent.description || '',
                  avatar: 'bot',
                  systemPrompt: agent.system_prompt || ''
                }}
                onClick={() => {}}
                index={index} 
              />
            </Link>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-red-500 flex-shrink-0" title="Eliminar agente">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>¿Eliminar agente "{agent.name}"?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta acción es permanente. El agente y todo su conocimiento asociado serán eliminados.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={() => onDeleteAgent(agent.id)} className="bg-red-600 hover:bg-red-700">
                    Eliminar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )) : (
          <p className="text-sm text-gray-500 text-center px-4">No has creado ningún agente todavía.</p>
        )}

        <div className="my-2 border-t border-white/10"></div>
        <Link to="/templates" onClick={onLinkClick} className="text-sm font-semibold text-gray-400 px-2 mb-2 flex items-center gap-2 hover:text-white">
          <LayoutTemplate className="w-4 h-4" />
          <span>Explorar Plantillas</span>
        </Link>
      </nav>

      <div className="mt-auto pt-4 border-t border-white/10">
        <Button
          variant="ghost"
          onClick={() => supabase.auth.signOut()}
          className="w-full justify-start gap-3 text-gray-300 hover:text-white hover:bg-white/10"
        >
          <LogOut className="w-5 h-5" />
          Cerrar Sesión
        </Button>
      </div>
    </aside>
  );
};