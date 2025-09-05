import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LogOut, Bot, Plus, LayoutTemplate, Trash2 } from "lucide-react";
import { motion } from "framer-motion";
import { AgentCard } from "@/components/agents/AgentCard";
import { Agent } from "./AppLayout";
import { Link, useNavigate } from "react-router-dom";

interface SidebarProps {
  userAgents: Agent[];
  onAgentSelect: (agent: Agent) => void;
  activeAgentId?: string;
  onClearChat: () => void;
}

export const Sidebar = ({ userAgents, onAgentSelect, activeAgentId, onClearChat }: SidebarProps) => {
  const navigate = useNavigate();

  return (
    <motion.aside
      initial={{ x: "-100%" }}
      animate={{ x: "0%" }}
      transition={{ duration: 0.5, ease: "easeInOut" }}
      className="w-80 h-screen p-4 flex flex-col bg-black/30 backdrop-blur-lg border-r border-white/10"
    >
      <Link to="/dashboard" className="flex items-center gap-3 mb-8">
        <Bot className="w-8 h-8 text-blue-400" />
        <h1 className="text-2xl font-bold text-white">Agentes IA</h1>
      </Link>
      
      <nav className="flex-1 flex flex-col gap-3 overflow-y-auto">
        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.5 }}
          onClick={() => navigate('/create-agent')}
          className="w-full text-left p-3 rounded-lg flex items-center gap-4 bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-400 border border-blue-500/30"
        >
          <div className="p-2 bg-white/10 rounded-md">
            <Plus className="w-6 h-6" />
          </div>
          <div>
            <p className="font-semibold">Crear Agente</p>
            <p className="text-sm text-blue-400">Empezar desde cero</p>
          </div>
        </motion.button>

        <div className="my-2 border-t border-white/10"></div>
        <div className="flex justify-between items-center px-2 mb-2">
          <h2 className="text-sm font-semibold text-gray-400">Mis Agentes</h2>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onClearChat} 
            className="h-7 w-7 text-gray-400 hover:text-white hover:bg-white/10"
            disabled={!activeAgentId}
            title="Limpiar historial de chat"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
        
        {userAgents.length > 0 ? userAgents.map((agent, index) => (
          <Link to={`/agent/${agent.id}`} key={agent.id} className={`rounded-xl ${agent.id === activeAgentId ? 'ring-2 ring-blue-400' : ''}`}>
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
        )) : (
          <p className="text-sm text-gray-500 text-center px-4">No has creado ningún agente todavía.</p>
        )}

        <div className="my-2 border-t border-white/10"></div>
        <Link to="/templates" className="text-sm font-semibold text-gray-400 px-2 mb-2 flex items-center gap-2 hover:text-white">
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
    </motion.aside>
  );
};