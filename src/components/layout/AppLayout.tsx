import { useState, useEffect } from "react";
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

  useEffect(() => {
    const fetchAgentsAndSetSelected = async () => {
      setIsLoading(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/login');
        return;
      }

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

      if (agentId) {
        const agentFromDb = agents?.find(a => a.id === agentId);
        if (agentFromDb) {
          setSelectedAgent(agentFromDb);
        } else {
          console.warn("Agent not found, redirecting to dashboard");
          navigate('/dashboard');
        }
      } else {
        setSelectedAgent(null);
      }

      setIsLoading(false);
    };

    fetchAgentsAndSetSelected();
  }, [agentId, navigate]);

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
              onAgentSelect={() => {}}
              activeAgentId={agentId}
              onClearChat={handleClearChat}
              onLinkClick={() => setIsSidebarOpen(false)}
            />
          </SheetContent>
        </Sheet>
        <MainContent 
          key={chatKey} 
          selectedAgent={selectedAgent} 
          onMenuClick={() => setIsSidebarOpen(true)} 
        />
      </div>
    );
  }

  return (
    <div className="flex w-full min-h-screen">
      <div className="w-80 h-screen flex flex-col bg-black/30 backdrop-blur-lg border-r border-white/10">
        <Sidebar
          userAgents={userAgents}
          onAgentSelect={setSelectedAgent}
          activeAgentId={agentId}
          onClearChat={handleClearChat}
        />
      </div>
      <MainContent key={chatKey} selectedAgent={selectedAgent} />
    </div>
  );
};