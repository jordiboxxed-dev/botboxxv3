import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { PublicChatInterface } from "./PublicChatInterface";

interface AgentConfig {
  widget_color: string;
  widget_position: 'left' | 'right';
}

export const ChatWidget = () => {
  const { agentId } = useParams<{ agentId: string }>();
  const [isOpen, setIsOpen] = useState(false);
  const [agentConfig, setAgentConfig] = useState<AgentConfig | null>(null);

  useEffect(() => {
    if (!agentId) return;

    const fetchAgentConfig = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("get-public-agent-config", {
          body: { agentId },
        });
        if (error) throw error;
        if (data.error) throw new Error(data.error);
        setAgentConfig(data);
      } catch (err) {
        console.error("Error fetching agent info:", err);
      }
    };
    fetchAgentConfig();
  }, [agentId]);

  if (!agentId || !agentConfig) {
    return null;
  }

  const widgetPositionClass = agentConfig.widget_position === 'left' ? 'left-4' : 'right-4';
  const widgetColorStyle = { backgroundColor: agentConfig.widget_color };

  return (
    <div className={`fixed bottom-4 z-50 ${widgetPositionClass}`}>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="w-[calc(100vw-2rem)] max-w-[400px] h-[calc(100vh-5rem)] max-h-[600px] relative"
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
  );
};