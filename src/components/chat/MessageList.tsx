import { useEffect, useRef } from "react";
import { ChatMessage } from "./ChatMessage";
import { Skeleton } from "@/components/ui/skeleton";
import { Bot } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface MessageListProps {
  messages: Message[];
  isLoading: boolean;
}

export const MessageList = ({ messages, isLoading }: MessageListProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  return (
    <div ref={scrollRef} className="flex-1 space-y-4 p-4 overflow-y-auto">
      {messages.map((msg, index) => (
        <ChatMessage key={index} role={msg.role} content={msg.content} />
      ))}
      {isLoading && (
        <div className="flex items-start gap-4 p-4 rounded-lg max-w-[80%] self-start bg-white/10">
           <div className="p-2 rounded-full bg-white/20">
             <Bot className="w-5 h-5 text-gray-300" />
           </div>
           <div className="space-y-2 pt-1">
             <Skeleton className="h-4 w-48" />
             <Skeleton className="h-4 w-32" />
           </div>
        </div>
      )}
    </div>
  );
};