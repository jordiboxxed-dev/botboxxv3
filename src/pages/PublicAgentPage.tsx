import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { PublicChatInterface } from "@/components/chat/PublicChatInterface";
import { supabase } from "@/integrations/supabase/client";
import { Agent } from "@/components/layout/AppLayout";
import { Skeleton } from "@/components/ui/skeleton";
import { Bot } from "lucide-react";

const PublicAgentPage = () => {
  const { agentId } = useParams<{ agentId: string }>();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (agent?.avatar_url) {
      let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
      }
      link.href = agent.avatar_url;
    }
  }, [agent]);

  useEffect(() => {
    if (!agentId) {
      setError("No se ha especificado un agente.");
      setIsLoading(false);
      return;
    }

    const fetchAgent = async () => {
      const { data, error } = await supabase
        .from("agents")
        .select("*")
        .eq("id", agentId)
        .single();

      if (error || !data) {
        setError("No se pudo encontrar el agente o no está disponible.");
      } else if (data.status !== 'active' || data.deleted_at) {
        setError("Este agente no está activo actualmente.");
      } else {
        setAgent(data);
      }
      setIsLoading(false);
    };

    fetchAgent();
  }, [agentId]);

  if (isLoading) {
    return (
      <div className="w-screen h-dvh bg-gray-900 flex items-center justify-center">
        <Skeleton className="w-full max-w-md h-[700px] rounded-2xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-screen h-dvh bg-gray-900 flex items-center justify-center text-center text-white p-4">
        <div>
          <Bot className="w-16 h-16 mx-auto mb-4 text-red-500" />
          <h1 className="text-2xl font-bold mb-2">Error</h1>
          <p className="text-gray-400">{error}</p>
        </div>
      </div>
    );
  }

  const backgroundStyle = agent?.public_background_url
    ? { backgroundImage: `url(${agent.public_background_url})` }
    : {};

  return (
    <div
      className="w-screen h-dvh bg-gray-900 bg-cover bg-center relative"
      style={backgroundStyle}
    >
      {/* Overlay oscuro para mejorar la legibilidad del chat */}
      <div className="absolute inset-0 bg-black/30"></div>
      
      {/* Contenedor del widget de chat */}
      <div className="absolute bottom-4 right-4 w-full max-w-[450px] h-full max-h-[calc(100dvh-2rem)] sm:max-h-[700px]">
        <PublicChatInterface />
      </div>
    </div>
  );
};

export default PublicAgentPage;