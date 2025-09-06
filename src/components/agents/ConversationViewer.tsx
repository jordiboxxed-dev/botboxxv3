import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { showError } from "@/utils/toast";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { ChatMessage } from "@/components/chat/ChatMessage";
import { Skeleton } from "@/components/ui/skeleton";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ConversationViewerProps {
  conversationId: string | null;
  onOpenChange: (open: boolean) => void;
}

export const ConversationViewer = ({ conversationId, onOpenChange }: ConversationViewerProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchMessages = async () => {
      if (!conversationId) return;
      setIsLoading(true);

      const { data, error } = await supabase
        .from("public_messages")
        .select("role, content")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });

      if (error) {
        showError("Error al cargar los mensajes de la conversación.");
        console.error(error);
      } else {
        setMessages(data as Message[]);
      }
      setIsLoading(false);
    };

    fetchMessages();
  }, [conversationId]);

  return (
    <Sheet open={!!conversationId} onOpenChange={onOpenChange}>
      <SheetContent className="w-full md:w-[450px] flex flex-col bg-gray-900/80 backdrop-blur-lg border-l-white/10 text-white">
        <SheetHeader>
          <SheetTitle>Historial de la Conversación</SheetTitle>
          <SheetDescription>Revisa la interacción completa del usuario con el agente.</SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto space-y-6 p-4 -mx-6">
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-16 w-3/4 self-start rounded-lg" />
              <Skeleton className="h-20 w-3/4 self-end rounded-lg" />
              <Skeleton className="h-12 w-1/2 self-start rounded-lg" />
            </div>
          ) : (
            messages.map((msg, index) => (
              <ChatMessage key={index} role={msg.role} content={msg.content} />
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};