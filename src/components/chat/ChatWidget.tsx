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
  system_prompt: string | null;
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
      // NOTE: This is a public query. Ensure RLS is set up correctly
      // to allow public reads on agent names if needed, or create a dedicated function.
      // For now, we assume agents table is not publicly readable for security.
      // We will create a dedicated edge function for this later.
      
      // Mock data for now:
      setAgentInfo({
        name: "Asistente Virtual",
        system_prompt: "Eres un asistente de IA.",
        company_name: "Mi Empresa"
      });

      // Add a welcome message
      setMessages([
        { role: "assistant", content: "¡Hola! ¿Cómo puedo ayudarte hoy?" }
      ]);
    };

    fetchAgentInfo();
  }, [agentId]);

  const handleSendMessage = async (prompt: string) => {
    // Placeholder for sending message logic
    const userMessage: Message = { role: "user", content: prompt };
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    // Simulate API call
    setTimeout(() => {
      const assistantMessage: Message = { role: "assistant", content: "Esta es una respuesta de demostración. La lógica real se implementará en el siguiente paso." };
      setMessages(prev => [...prev, assistantMessage]);
      setIsLoading(false);
    }, 1500);
  };

  if (!agentId) {
    return null; // Or show an error state
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
            className="w-[400px] h-[600px] bg-gray-800/80 backdrop-blur-lg rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-white/10"
          >
            <header className="p-4 bg-black/20 flex items-center justify-between border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/10 rounded-full">
                  <Bot className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-white">{agentInfo?.name || "Chat"}</h3>
                  <p className="text-xs text-gray-400">En línea</p>
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