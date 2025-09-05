import { useState, useEffect } from "react";
import { Sidebar } from "./Sidebar";
import { MainContent } from "./MainContent";
import { Agent as MockAgent } from "@/data/mock-agents"; // Renombrado para evitar conflictos
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { SkeletonLoader } from "./SkeletonLoader";

// Definimos un tipo para los agentes que vienen de la DB
export interface Agent {
  id: string;
  name: string;
  description: string | null;
  system_prompt: string | null;
  business_context: string | null;
  // Añade más campos si es necesario
}

export const AppLayout = () => {
  const { agentId } = useParams();
  const navigate = useNavigate();
  const [userAgents, setUserAgents] = useState<Agent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<Agent | MockAgent | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchAgentsAndSetSelected = async () => {
      setIsLoading(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/login');
        return;
      }

      // Fetch todos los agentes del usuario
      const { data: agents, error } = await supabase
        .from('agents')
        .select('*')
        .eq('user_id', user.id);

      if (error) {
        console.error("Error fetching agents:", error);
        setIsLoading(false);
        return;
      }
      
      setUserAgents(agents || []);

      // Encontrar y establecer el agente seleccionado basado en la URL
      if (agentId) {
        const agentFromDb = agents?.find(a => a.id === agentId);
        if (agentFromDb) {
          setSelectedAgent(agentFromDb);
        } else {
          // Podría ser un ID inválido, redirigir o mostrar error
          console.warn("Agent not found, redirecting to dashboard");
          navigate('/dashboard');
        }
      } else {
        // Si no hay ID en la URL, no seleccionamos ninguno
        setSelectedAgent(null);
      }

      setIsLoading(false);
    };

    fetchAgentsAndSetSelected();
  }, [agentId, navigate]);

  if (isLoading) {
    return <SkeletonLoader />;
  }

  return (
    <div className="flex w-full min-h-screen">
      <Sidebar userAgents={userAgents} onAgentSelect={setSelectedAgent} activeAgentId={agentId} />
      <MainContent selectedAgent={selectedAgent} />
    </div>
  );
};