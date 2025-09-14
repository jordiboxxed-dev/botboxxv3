import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { PublicChatInterface } from "@/components/chat/PublicChatInterface";
import { supabase } from "@/integrations/supabase/client";
import { Agent } from "@/components/layout/AppLayout";
import { Skeleton } from "@/components/ui/skeleton";
import { Bot, MessageSquare, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";

const PublicAgentPage = () => {
  const { agentId } = useParams<{ agentId: string }>();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

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
        <Skeleton className="w-16 h-16 rounded-full" />
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

  const widgetPositionClass = agent?.widget_position === 'left' ? 'left-4' : 'right-4';
  const widgetColorStyle = { backgroundColor: agent?.widget_color || '#3b82f6' };

  return (
    <div
      className="w-screen h-dvh bg-gray-900 bg-cover bg-center relative"
      style={backgroundStyle}
    >
      <div className="absolute inset-0 bg-black/30"></div>
      
      <div className={`fixed bottom-4 z-50 ${widgetPositionClass}`}>
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="w-[calc(100vw-2rem)] max-w-[400px] h-[calc(100dvh-5rem)] max-h-[600px] relative"
            >
              <PublicChatInterface />
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setIsOpen(false)} 
                className="absolute top-2 right-2 text-white/80 hover:text-white hover:bg-white/20 z-10"
              >
                <X className="w-5 h-5" />
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.5, type: "spring", stiffness: 260, damping: 20 }}
        >
          <Button
            onClick={() => setIsOpen(!isOpen)}
            className="w-16 h-16 rounded-full shadow-lg flex items-center justify-center"
            style={widgetColorStyle}
          >
            {isOpen ? <X className="w-8 h-8 text-white" /> : <MessageSquare className="w-8 h-8 text-white" />}
          </Button>
        </motion.div>
      </div>
    </div>
  );
};

export default PublicAgentPage;