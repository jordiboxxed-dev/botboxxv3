import { mockAgents, Agent } from "@/data/mock-agents";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LogOut, Bot, Plus } from "lucide-react";
import { motion } from "framer-motion";
import { AgentCard } from "@/components/agents/AgentCard";

interface SidebarProps {
  onAgentSelect: (agent: Agent) => void;
}

export const Sidebar = ({ onAgentSelect }: SidebarProps) => {
  return (
    <motion.aside
      initial={{ x: "-100%" }}
      animate={{ x: "0%" }}
      transition={{ duration: 0.5, ease: "easeInOut" }}
      className="w-80 h-screen p-4 flex flex-col bg-black/30 backdrop-blur-lg border-r border-white/10"
    >
      <div className="flex items-center gap-3 mb-8">
        <Bot className="w-8 h-8 text-blue-400" />
        <h1 className="text-2xl font-bold text-white">Agentes IA</h1>
      </div>
      <nav className="flex-1 flex flex-col gap-3">
        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.5 }}
          onClick={() => console.log("Crear nuevo agente")}
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

        {mockAgents.map((agent, index) => (
          <AgentCard 
            key={agent.id} 
            agent={agent} 
            onClick={onAgentSelect} 
            index={index} 
          />
        ))}
      </nav>
      <div className="mt-auto">
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