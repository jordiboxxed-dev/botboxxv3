import { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { MessageList } from "./MessageList";
import { ChatInput } from "./ChatInput";
import { supabase } from "@/integrations/supabase/client";
import { showError } from "@/utils/toast";
import { Bot } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface AgentConfig {
  name: string;
  company_name: string | null;
  widget_color: string;
  widget_welcome_message: string;
}

export const PublicChatInterface = () => {
  const { agentId } = useParams<{ agentId: string }>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [agentConfig, setAgentConfig] = useState<AgentConfig | null>(null);
  const conversationIdRef = useRef<string | null>(null);

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

    if (!conversationIdRef.current) {
      conversationIdRef.current = crypto.randomUUID();
    }

    const userMessage: Message = { role: "user", content: prompt };
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    // Add a placeholder for the assistant's message
    setMessages(prev => [...prev, { role: "assistant", content: "" }]);

    try {
      const history = messages;
      const { data: stream, error } = await supabase.functions.invoke("ask-public-agent", {
        body: { 
          agentId, 
          prompt, 
          history, 
          conversationId: conversationIdRef.current 
        },
        responseType: 'stream'
      });

      if (error) {
        throw error;
      }

      if (!stream) {
        throw new Error("No se pudo leer la respuesta del servidor.");
      }
      
      const reader = stream.getReader();
      const decoder = new TextDecoder();
      let fullResponse = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        fullResponse += chunk;
        setMessages(prev => {
          const newMessages = [...prev];
          newMessages[newMessages.length - 1].content = fullResponse;
          return newMessages;
        });
      }

    } catch (err) {
      console.error(err);
      const errorMessageText = (err instanceof Error) ? err.message : "Ocurrió un error desconocido.";
      showError(`Error al contactar al agente: ${errorMessageText}`);
      setMessages(prev => {
        const newMessages = [...prev];
        newMessages[newMessages.length - 1].content = `Lo siento, tuve un problema para procesar tu solicitud.\n\n**Detalle:** ${errorMessageText}`;
        return newMessages;
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!agentConfig) {
    return (
      <div className="w-full max-w-[400px] h-full max-h-[600px] bg-gray-800/80 backdrop-blur-lg rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-white/10">
        <div className="p-4 flex items-center gap-3 border-b border-white/10">
          <Skeleton className="w-12 h-12 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
        <div className="flex-1 p-4 space-y-4">
          <Skeleton className="h-16 w-3/4 rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-gray-800/80 backdrop-blur-lg rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-white/10">
      <header 
        className="p-4 flex items-center justify-between border-b border-white/10 flex-shrink-0"
        style={{ backgroundColor: agentConfig.widget_color }}
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white/20 rounded-full">
            <Bot className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-white">{agentConfig.name}</h3>
            <p className="text-xs text-white/80">{agentConfig.company_name || "En línea"}</p>
          </div>
        </div>
      </header>
      <MessageList messages={messages} isLoading={isLoading} />
      <ChatInput onSendMessage={handleSendMessage} isLoading={isLoading} />
    </div>
  );
};