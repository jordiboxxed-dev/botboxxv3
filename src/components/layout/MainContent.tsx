import { Agent } from "@/data/mock-agents";
import { motion } from "framer-motion";
import { Bot } from "lucide-react";

interface MainContentProps {
  selectedAgent: Agent | null;
}

export const MainContent = ({ selectedAgent }: MainContentProps) => {
  return (
    <motion.main
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5, delay: 0.3 }}
      className="flex-1 flex flex-col h-screen"
    >
      {selectedAgent ? (
        <div className="flex-1 flex flex-col p-6">
          <header className="p-4 bg-black/20 backdrop-blur-lg border-b border-white/10 rounded-t-xl">
            <h2 className="text-xl font-bold text-white">{selectedAgent.name}</h2>
            <p className="text-sm text-gray-400">{selectedAgent.description}</p>
          </header>
          <div className="flex-1 bg-black/10 p-4 rounded-b-xl">
            {/* Chat messages will go here */}
          </div>
          <div className="p-4 bg-black/20 backdrop-blur-lg border-t border-white/10 rounded-b-xl mt-auto">
            {/* Message input will go here */}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-center text-gray-400">
          <Bot className="w-24 h-24 mb-4 text-gray-500" />
          <h2 className="text-2xl font-bold text-white">Bienvenido</h2>
          <p>Selecciona un agente de la lista para comenzar a chatear.</p>
        </div>
      )}
    </motion.main>
  );
};