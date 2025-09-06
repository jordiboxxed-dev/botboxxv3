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

interface AgentInfo {
  name: string;
  company_name: string | null;
}

export const ChatWidget = () => {
  const { agentId } = useParams<{ agentId: string }>();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [agentInfo, setAgentInfo] = useState<AgentInfo | null>(null);

  useEffect(() => {
    if (!agentId) return;

    const fetchAgentInfo = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("get-public-agent-name", {
          body: { agentId },
        });

        if (error) throw error;
        if (data.error) throw new Error(data.error);

        setAgentInfo(data);
        setMessages([
          { role: "assistant", content: `¡Hola! Soy ${data.name}. ¿Cómo puedo ayudarte hoy?` }
        ]);
      } catch (err) {
        console.error("Error fetching agent info:", err);
        showError("No se pudo cargar la información del agente.");
        setMessages([{ role: "assistant", content: "Lo siento, no pude cargar la configuración de este agente." }]);
      }
    };

    fetchAgentInfo();
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

  if (!agentId) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="w-[calc(100vw-2rem)] max-w-[400px] h-[calc(100vh-5rem)] max-h-[600px] bg-gray-800/80 backdrop-blur-lg rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-white/10"
          >
            <header className="p-4 bg-black/20 flex items-center justify-between border-b border-white/10 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/10 rounded-full">
                  <Bot className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-white">{agentInfo?.name || "Chat"}</h3>
                  <p className="text-xs text-gray-400">{agentInfo?.company_name || "En línea"}</p>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-white">
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
        >
          {isOpen ? <X className="w-8 h-8" /> : <MessageSquare className="w-8 h-8" />}
        </Button>
      </motion.div>
    </div>
  );
};