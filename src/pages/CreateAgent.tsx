import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { showError, showSuccess } from "@/utils/toast";
import { motion } from "framer-motion";
import { AgentForm } from "@/components/agents/AgentForm";
import { Agent } from "@/components/layout/AppLayout";
import { useInteractiveCard } from "@/hooks/useInteractiveCard";
import { cn } from "@/lib/utils";
import React from "react";

const CreateAgent = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const cardProps = useInteractiveCard<HTMLDivElement>({ glowColor: "rgba(59, 130, 246, 0.5)" });

  const handleCreateAgent = async (agentData: Omit<Agent, 'id' | 'user_id' | 'created_at'>) => {
    setIsLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        showError("No se pudo identificar al usuario. Por favor, inicia sesión de nuevo.");
        setIsLoading(false);
        return;
    }

    const { data, error } = await supabase
      .from("agents")
      .insert({ user_id: user.id, ...agentData })
      .select()
      .single();

    setIsLoading(false);

    if (error) {
      showError("Error al crear el agente: " + error.message);
    } else if (data) {
      showSuccess("¡Agente creado con éxito!");
      navigate(`/agent/${data.id}`);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 p-4">
      <div 
        {...cardProps}
        ref={cardProps.ref}
        className={cn(cardProps.className, "w-full max-w-3xl mx-auto bg-black/30 border border-white/10 rounded-2xl p-8 shadow-2xl")}
      >
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <h1 className="text-3xl font-bold text-white mb-2">Crear Nuevo Agente</h1>
          <p className="text-gray-400 mb-8">Dale vida a tu asistente de IA personalizado.</p>
        </motion.div>
        <AgentForm onSubmit={handleCreateAgent} isLoading={isLoading} />
      </div>
    </div>
  );
};

export default CreateAgent;