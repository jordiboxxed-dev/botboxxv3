import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { PublicChatInterface, AgentConfig } from "@/components/chat/PublicChatInterface";
import { supabase } from "@/integrations/supabase/client";
import { Bot } from "lucide-react";
import { motion } from "framer-motion";

interface PublicAgentPageConfig extends AgentConfig {
  public_background_url: string | null;
}

const PublicAgentPage = () => {
  const { agentId } = useParams<{ agentId: string }>();
  const [agentConfig, setAgentConfig] = useState<PublicAgentPageConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (agentConfig?.avatar_url) {
      let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
      }
      link.href = agentConfig.avatar_url;
    }
  }, [agentConfig]);

  useEffect(() => {
    if (!agentId) {
      setError("No se ha especificado un agente.");
      setIsLoading(false);
      return;
    }

    const fetchAgent = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('get-public-agent-config', {
          body: { agentId }
        });

        if (error) throw error;
        
        setAgentConfig({
          ...data,
          widget_color: data.widget_color || '#3b82f6',
          widget_welcome_message: data.widget_welcome_message || `¡Hola! Soy ${data.name}, ¿cómo puedo ayudarte?`,
        });
      } catch (err) {
        setError((err as Error).message || "No se pudo cargar la información del agente.");
        console.error("Error fetching public agent config in PublicAgentPage:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAgent();
  }, [agentId]);

  if (isLoading) {
    return (
      <div className="w-screen h-dvh bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-screen h-dvh bg-gray-900 flex items-center justify-center text-center text-white p-4">
        <div>
          <Bot className="w-16 h-16 mx-auto mb-4 text-red-500" />
          <h1 className="text-2xl font-bold mb-2">Error al cargar el agente</h1>
          <p className="text-gray-400">{error}</p>
        </div>
      </div>
    );
  }

  const backgroundStyle = agentConfig?.public_background_url
    ? { backgroundImage: `url(${agentConfig.public_background_url})` }
    : {};

  return (
    <div
      className="w-screen h-dvh bg-gray-900 bg-cover bg-center flex items-center justify-center p-0 sm:p-4"
      style={backgroundStyle}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm"></div>
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="w-full h-full sm:w-full sm:max-w-lg sm:h-[90vh] sm:max-h-[700px] z-10"
      >
        {agentConfig && <PublicChatInterface agentConfig={agentConfig} />}
      </motion.div>
    </div>
  );
};

export default PublicAgentPage;