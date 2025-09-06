import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { showError, showSuccess } from "@/utils/toast";
import { motion } from "framer-motion";
import { AgentForm } from "@/components/agents/AgentForm";
import { Agent } from "@/components/layout/AppLayout";
import { Skeleton } from "@/components/ui/skeleton";
import { useInteractiveCard } from "@/hooks/useInteractiveCard";
import { cn } from "@/lib/utils";
import React from "react";

const EditAgent = () => {
  const navigate = useNavigate();
  const { agentId } = useParams();
  const [isLoading, setIsLoading] = useState(false);
  const [agent, setAgent] = useState<Agent | null>(null);
  const [isFetching, setIsFetching] = useState(true);
  const cardProps = useInteractiveCard({ glowColor: "rgba(59, 130, 246, 0.5)" });

  useEffect(() => {
    const fetchAgent = async () => {
      if (!agentId) {
        navigate('/dashboard');
        return;
      }
      
      setIsFetching(true);
      const { data, error } = await supabase
        .from('agents')
        .select('*')
        .eq('id', agentId)
        .single();

      if (error || !data) {
        showError("No se pudo encontrar el agente.");
        navigate('/dashboard');
      } else {
        setAgent(data);
      }
      setIsFetching(false);
    };
    fetchAgent();
  }, [agentId, navigate]);

  const handleUpdateAgent = async (agentData: Omit<Agent, 'id' | 'user_id' | 'created_at'>) => {
    if (!agentId) return;
    
    setIsLoading(true);
    const { error } = await supabase
      .from("agents")
      .update(agentData)
      .eq('id', agentId);

    setIsLoading(false);

    if (error) {
      showError("Error al actualizar el agente: " + error.message);
    } else {
      showSuccess("¡Agente actualizado con éxito!");
      navigate(`/agent/${agentId}`);
    }
  };

  if (isFetching) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 p-4">
        <div className="w-full max-w-3xl mx-auto space-y-6">
          <Skeleton className="h-12 w-1/2" />
          <Skeleton className="h-8 w-3/4" />
          <div className="space-y-4 pt-8">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 p-4">
      <div 
        {...cardProps}
        ref={cardProps.ref as React.Ref<HTMLDivElement>}
        className={cn(cardProps.className, "w-full max-w-3xl mx-auto bg-black/30 border border-white/10 rounded-2xl p-8 shadow-2xl")}
      >
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <h1 className="text-3xl font-bold text-white mb-2">Editar Agente</h1>
          <p className="text-gray-400 mb-8">Ajusta la configuración de "{agent?.name}".</p>
        </motion.div>
        <AgentForm 
          onSubmit={handleUpdateAgent} 
          isLoading={isLoading} 
          initialData={agent!}
          submitButtonText="Guardar Cambios"
        />
      </div>
    </div>
  );
};

export default EditAgent;