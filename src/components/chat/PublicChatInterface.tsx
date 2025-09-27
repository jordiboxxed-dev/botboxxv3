import { useState, useRef } from "react";
import { useParams } from "react-router-dom";
import { MessageList } from "./MessageList";
import { ChatInput } from "./ChatInput";
import { supabase, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "@/integrations/supabase/client";
import { showError } from "@/utils/toast";
import { Bot } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export interface AgentConfig {
  name: string;
  company_name: string | null;
  widget_color: string;
  widget_welcome_message: string;
  avatar_url: string | null;
}

interface PublicChatInterfaceProps {
  agentConfig: AgentConfig;
}

export const PublicChatInterface = ({ agentConfig }: PublicChatInterfaceProps) => {
  const { agentId } = useParams<{ agentId: string }>();
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: agentConfig.widget_welcome_message || `¡Hola! Soy ${agentConfig.name}. ¿Cómo puedo ayudarte hoy?` }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const conversationIdRef = useRef<string | null>(null);

  const handleSendMessage = async (prompt: string) => {
    if (!agentId) return;

    if (!conversationIdRef.current) {
      conversationIdRef.current = crypto.randomUUID();
    }

    const userMessage: Message = { role: "user", content: prompt };
    setMessages(prevMessages => [...prevMessages, userMessage]);
    setIsLoading(true);

    setMessages(prev => [...prev, { role: "assistant", content: "" }]);

    try {
      const history = messages;
      const response = await fetch(`${SUPABASE_URL}/functions/v1/ask-public-agent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ 
          agentId, 
          prompt, 
          history, 
          conversationId: conversationIdRef.current 
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Error del servidor: ${response.statusText}`);
      }

      if (!response.body) {
        throw new Error("No se pudo leer la respuesta del servidor.");
      }
      
      const reader = response.body.getReader();
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

  return (
    <div className="w-full h-full bg-gray-800/80 backdrop-blur-lg rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-white/10">
      <header 
        className="p-4 flex items-center justify-between border-b border-white/10 flex-shrink-0"
        style={{ backgroundColor: agentConfig.widget_color }}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
            {agentConfig.avatar_url ? (
              <img src={agentConfig.avatar_url} alt={`${agentConfig.name} logo`} className="w-full h-full rounded-full object-contain" />
            ) : (
              <Bot className="w-6 h-6 text-white" />
            )}
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