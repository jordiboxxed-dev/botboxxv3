import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, X, Bot } from "lucide-react";
import { MessageList } from "./MessageList";
import { ChatInput } from "./ChatInput";
import { supabase } from "@/integrations/supabase/client";
import { showError } from "@/utils/toast";
import { Button } from "@/components/ui/button";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface AgentConfig {
  name: string;
  company_name: string | null;
  widget_color: string;
  widget_welcome_message: string;
  widget_position: 'left' | 'right';
}

export const ChatWidget = () => {
  const { agentId } = useParams<{ agentId: string }>();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
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
        setMessages([
          { role: "assistant", content: data.widget_welcome_message || `¡Hola! Soy ${data.name}. ¿Cómo puedo ayudarte hoy?` }
        ]);
      } catch (err) {
        console.error("Error fetching agent info:", err);
        showError("No se pudo cargar la información del agente.");
        setMessages([{ role: "assistant", content: "Lo siento, no pude cargar la configuración de este agente." }]);
      }
    };

    fetchAgentConfig();
  }, [agentId]);

  const handleSendMessage = async (prompt: string) => {
    if (!agentId) return;

    const userMessage: Message = { role: "user", content: prompt };
    const currentMessages = [...messages, userMessage];
    setMessages(currentMessages);
    setIsLoading(true);

    try {
      const history = currentMessages.slice(0, -1);
      const { data, error } = await supabase.functions.invoke("ask-public-agent", {
        body: { agentId, prompt, history },
      });

      if (error) throw new Error(error.message);
      if (data.error) throw new Error(data.error);

      const assistantMessage: Message = { role: "assistant", content: data.response };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      console.error(err);
      const errorMessageText = (err instanceof Error) ? err.message : "Ocurrió un error desconocido.";
      showError(`Error al contactar al agente: ${errorMessageText}`);
      const errorMessage: Message = { role: "assistant", content: `Lo siento, tuve un problema para procesar tu solicitud.\n\n**Detalle:** ${errorMessageText}` };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

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
            className="w-[calc(100vw-2rem)] max-w-[400px] h-[calc(100vh-5rem)] max-h-[600px] bg-gray-800/80 backdrop-blur-lg rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-white/10"
          >
            <header 
              className="p-4 flex items-center justify-between border-b border-white/10 flex-shrink-0"
              style={widgetColorStyle}
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-full">
                  <Bot className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-white">{agentConfig?.name || "Chat"}</h3>
                  <p className="text-xs text-white/80">{agentConfig?.company_name || "En línea"}</p>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)} className="text-white/80 hover:text-white">
                <X className="w-5 h-5" />
              </Button>
            </header>
            <MessageList messages={messages} isLoading={isLoading} />
            <ChatInput onSendMessage={handleSendMessage} isLoading={isLoading} />
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