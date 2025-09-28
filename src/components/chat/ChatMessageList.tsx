import { useEffect, useRef } from "react";
import { ChatMessage } from "./ChatMessage";
import { Bot } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ChatMessageListProps {
  messages: Message[];
  isLoading: boolean;
}

export const MessageList = ({ messages, isLoading }: ChatMessageListProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  return (
    <div ref={scrollRef} className="flex-1 space-y-6 p-4 overflow-y-auto">
      {messages.length === 0 && !isLoading ? (
        <div className="flex flex-col items-center justify-center h-full text-center text-gray-500">
          <Bot className="w-16 h-16 mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">¡Hola! ¿En qué puedo ayudarte?</h3>
          <p>Empieza escribiendo un mensaje para interactuar con tu agente.</p>
        </div>
      ) : (
        messages.map((msg, index) => (
          <ChatMessage key={index} role={msg.role} content={msg.content} />
        ))
      )}
    </div>
  );
};