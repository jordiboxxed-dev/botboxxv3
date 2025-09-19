import { useState, useEffect, useCallback } from "react";
import { Sidebar } from "./Sidebar";
import { MainContent } from "./MainContent";
import { Agent as MockAgent } from "@/data/mock-agents";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { SkeletonLoader } from "./SkeletonLoader";
import { showError, showSuccess } from "@/utils/toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sheet, SheetContent } from "@/components/ui/sheet";

export interface Agent {
  id: string;
  name: string;
  description: string | null;
  company_name: string | null;
  system_prompt: string | null;
  widget_color: string | null;
  widget_welcome_message: string | null;
  widget_position: string | null;
  status: string;
  deleted_at: string | null;
  model: string | null;
  webhook_url: string | null;
  public_background_url: string | null;
  avatar_url: string | null;
}

export const AppLayout = () => {
  const { agentId } = useParams();
  const navigate = useNavigate();
  const [userAgents, setUserAgents] = useState<Agent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<Agent | MockAgent | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [chatKey, setChatKey] = useState(0);
  const isMobile = useIsMobile();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const fetchAgents = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate('/login');
      return { agents: [], error: 'No user' };
    }

    const { data: profile, error: profileError } = await supabase.from('profiles').select('role, agency_id').eq('id', user.id).single();
    if (profileError) {
      showError("No se pudo cargar tu perfil de usuario.");
      return { agents: [], error: profileError.message };
    }

    let query = supabase.from('agents').select('*');
    
    if (profile.role === 'admin') {
      // Admin ve todos los agentes
    } else if (profile.role === 'agency_owner' && profile.agency_id) {
      // Dueño de agencia ve los agentes de todos los usuarios en su agencia
      const { data: agencyUsers, error: agencyUsersError } = await supabase
        .from('profiles')
        .select('id')
        .eq('agency_id', profile.agency_id);
      
      if (agencyUsersError) {
        showError("No se pudieron cargar los clientes de la agencia.");
        return { agents: [], error: agencyUsersError.message };
      }
      
      const userIds = agencyUsers.map(u => u.id);
      query = query.in('user_id', userIds);
    } else {
      // Usuario normal solo ve sus propios agentes
      query = query.eq('user_id', user.id);
    }
    
    const { data: agents, error } = await query.is('deleted_at', null);

    if (error) {
      console.error("Error fetching agents:", error);
      return { agents: [], error: error.message };
    }
    
    setUserAgents(agents || []);
    return { agents: agents || [], error: null };
  }, [navigate]);

  useEffect(() => {
    const fetchAndSetData = async () => {
      setIsLoading(true);
      const { agents } = await fetchAgents();
      
      if (agentId) {
        const agentFromDb = agents.find(a => a.id === agentId);
        if (agentFromDb) {
          setSelectedAgent(agentFromDb);
        } else {
          console.warn("Agent not found or you don't have permission, redirecting to dashboard");
          navigate('/dashboard');
        }
      } else {
        setSelectedAgent(null);
      }
      setIsLoading(false);
    };
    fetchAndSetData();
  }, [agentId, fetchAgents, navigate]);

  const handleClearChat = async () => {
    if (!selectedAgent) {
      showError("Selecciona un agente para limpiar el chat.");
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from("messages")
      .delete()
      .eq("agent_id", selectedAgent.id)
      .eq("user_id", user.id);

    if (error) {
      showError("No se pudo limpiar el historial del chat.");
      console.error(error);
    } else {
      showSuccess("Historial de chat limpiado.");
      setChatKey(prevKey => prevKey + 1);
    }
  };

  const handleDeleteAgent = async (agentToDeleteId: string) => {
    const { error } = await supabase
      .from('agents')
      .update({ deleted_at: new Date().toISOString() }) // Soft delete
      .eq('id', agentToDeleteId);

    if (error) {
      showError("Error al eliminar el agente: " + error.message);
    } else {
      showSuccess("Agente eliminado correctamente.");
      await fetchAgents(); // Refresh the agent list
      if (agentId === agentToDeleteId) {
        navigate('/dashboard'); // Navigate away if deleting the active agent
      }
    }
  };

  if (isLoading) {
    return <SkeletonLoader />;
  }

  if (isMobile) {
    return (
      <div className="flex w-full min-h-screen bg-gray-900">
        <Sheet open={isSidebarOpen} onOpenChange={setIsSidebarOpen}>
          <SheetContent side="left" className="p-0 w-80 bg-black/50 backdrop-blur-lg border-r-0">
            <Sidebar
              userAgents={userAgents}
              activeAgentId={agentId}
              onDeleteAgent={handleDeleteAgent}
              onLinkClick={() => setIsSidebarOpen(false)}
            />
          </SheetContent>
        </Sheet>
        <MainContent 
          key={chatKey} 
          selectedAgent={selectedAgent} 
          onMenuClick={() => setIsSidebarOpen(true)} 
          onClearChat={handleClearChat}
        />
      </div>
    );
  }

  return (
    <div className="flex w-full min-h-screen">
      <div className="w-80 h-screen flex flex-col bg-black/30 backdrop-blur-lg border-r border-white/10">
        <Sidebar
          userAgents={userAgents}
          activeAgentId={agentId}
          onDeleteAgent={handleDeleteAgent}
        />
      </div>
      <MainContent 
        key={chatKey} 
        selectedAgent={selectedAgent} 
        onClearChat={handleClearChat} 
      />
    </div>
  );
};