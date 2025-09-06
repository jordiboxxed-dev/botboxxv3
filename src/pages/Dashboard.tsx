import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Bot, PlusCircle } from "lucide-react";
import { motion } from "framer-motion";
import { useInteractiveCard } from "@/hooks/useInteractiveCard";
import { cn } from "@/lib/utils";
import React from "react";
import { AnalyticsDashboard } from "@/components/dashboard/AnalyticsDashboard";

const Dashboard = () => {
  const blueCardProps = useInteractiveCard({ glowColor: "rgba(59, 130, 246, 0.4)" });
  const greenCardProps = useInteractiveCard({ glowColor: "rgba(52, 211, 153, 0.4)" });

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900 text-white p-4">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center mb-8"
      >
        <h1 className="text-4xl font-bold mb-2">BotBoxx Agents Hub</h1>
        <p className="text-lg text-gray-400">Gestiona y crea tus agentes de IA.</p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl w-full">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <Link to="/templates" className="block h-full">
            <div 
              {...blueCardProps}
              ref={blueCardProps.ref as React.Ref<HTMLDivElement>}
              className={cn(blueCardProps.className, "bg-black/30 p-8 rounded-xl border border-white/10 hover:border-blue-400 transition-all duration-300 flex flex-col items-center text-center h-full")}
            >
              <Bot className="w-16 h-16 mb-4 text-blue-400" />
              <h2 className="text-2xl font-semibold mb-2">Ver Agentes y Plantillas</h2>
              <p className="text-gray-400 mb-6">Explora plantillas pre-configuradas o gestiona los agentes que ya has creado.</p>
              <Button className="mt-auto">Explorar</Button>
            </div>
          </Link>
        </motion.div>
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <Link to="/create-agent" className="block h-full">
            <div 
              {...greenCardProps}
              ref={greenCardProps.ref as React.Ref<HTMLDivElement>}
              className={cn(greenCardProps.className, "bg-black/30 p-8 rounded-xl border border-white/10 hover:border-green-400 transition-all duration-300 flex flex-col items-center text-center h-full")}
            >
              <PlusCircle className="w-16 h-16 mb-4 text-green-400" />
              <h2 className="text-2xl font-semibold mb-2">Crear desde Cero</h2>
              <p className="text-gray-400 mb-6">Diseña un agente personalizado con su propia personalidad y conocimiento.</p>
              <Button variant="secondary" className="mt-auto">Crear Agente</Button>
            </div>
          </Link>
        </motion.div>
      </div>

      <div className="w-full max-w-4xl mt-8">
        <div className="my-6 border-t border-white/10"></div>
      </div>

      <AnalyticsDashboard />
    </div>
  );
};

export default Dashboard;