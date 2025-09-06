import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { showError } from "@/utils/toast";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageSquare, ChevronRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { ConversationViewer } from "./ConversationViewer";

interface Conversation {
  id: string;
  created_at: string;
  first_message_content: string | null;
}

interface ConversationHistoryProps {
  agentId: string;
}

export const ConversationHistory = ({ agentId }: ConversationHistoryProps) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);

  useEffect(() => {
    const fetchConversations = async () => {
      if (!agentId) return;
      setIsLoading(true);

      const { data, error } = await supabase
        .from("public_conversations")
        .select("id, created_at, public_messages(content)")
        .eq("agent_id", agentId)
        .order("created_at", { ascending: false });

      if (error) {
        showError("Error al cargar las conversaciones.");
        console.error(error);
      } else {
        const formattedData = data.map(conv => ({
          id: conv.id,
          created_at: conv.created_at,
          // @ts-ignore
          first_message_content: conv.public_messages[0]?.content || "Conversación vacía"
        }));
        setConversations(formattedData);
      }
      setIsLoading(false);
    };

    fetchConversations();
  }, [agentId]);

  return (
    <div className="h-full flex flex-col">
      {isLoading ? (
        <div className="space-y-3 p-4">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : conversations.length > 0 ? (
        <div className="flex-1 overflow-y-auto p-2">
          {conversations.map(conv => (
            <button
              key={conv.id}
              onClick={() => setSelectedConversationId(conv.id)}
              className="w-full text-left flex items-center gap-4 p-3 rounded-lg hover:bg-white/10 transition-colors"
            >
              <div className="p-2 bg-black/30 rounded-full">
                <MessageSquare className="w-5 h-5 text-gray-400" />
              </div>
              <div className="flex-1 overflow-hidden">
                <p className="text-sm text-white truncate font-medium">{conv.first_message_content}</p>
                <p className="text-xs text-gray-500">
                  {formatDistanceToNow(new Date(conv.created_at), { addSuffix: true, locale: es })}
                </p>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-600" />
            </button>
          ))}
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-center text-gray-500">
          <MessageSquare className="w-12 h-12 mb-4" />
          <h3 className="font-semibold text-white">No hay conversaciones</h3>
          <p className="text-sm">Las interacciones con tu widget público aparecerán aquí.</p>
        </div>
      )}
      <ConversationViewer
        conversationId={selectedConversationId}
        onOpenChange={() => setSelectedConversationId(null)}
      />
    </div>
  );
};