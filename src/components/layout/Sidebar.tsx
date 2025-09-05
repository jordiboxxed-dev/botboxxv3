import { mockAgents, Agent } from "@/data/mock-agents";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LogOut, Bot } from "lucide-react";
import { motion } from "framer-motion";
import * as LucideIcons from "lucide-react";

interface SidebarProps {
  onAgentSelect: (agent: Agent) => void;
}

const Icon = ({ name, ...props }: { name: string } & LucideIcons.LucideProps) => {
  const LucideIcon = LucideIcons[name as keyof typeof LucideIcons] as LucideIcons.LucideIcon;
  return LucideIcon ? <LucideIcon {...props} /> : <Bot {...props} />;
};

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
      <nav className="flex-1 flex flex-col gap-2">
        {mockAgents.map((agent, index) => (
          <motion.button
            key={agent.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 * index + 0.5 }}
            onClick={() => onAgentSelect(agent)}
            className="w-full text-left p-3 rounded-lg flex items-center gap-4 hover:bg-white/10 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            <div className="p-2 bg-white/10 rounded-md">
              <Icon name={agent.avatar} className="w-6 h-6 text-gray-300" />
            </div>
            <div>
              <p className="font-semibold text-white">{agent.name}</p>
              <p className="text-sm text-gray-400">{agent.description}</p>
            </div>
          </motion.button>
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