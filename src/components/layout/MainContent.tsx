import { Agent as DbAgent } from "./AppLayout";
import { Agent as MockAgent } from "@/data/mock-agents";
import { motion } from "framer-motion";
import { Bot, Settings, Menu, Code, MessageCircle, BookOpen, Copy, Check, MessageSquareX, Zap } from "lucide-react";
import { useState, useEffect } from "react";
import { MessageList } from "../chat/ChatMessageList";
import { ChatInput } from "../chat/ChatInput";
import { supabase } from "@/integrations/supabase/client";
import { showError, showSuccess } from "@/utils/toast";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { KnowledgeSource, KnowledgeSourceManager } from "@/components/knowledge/KnowledgeSourceManager";
import { EmbedDialog } from "@/components/agents/EmbedDialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConversationHistory } from "@/components/agents/ConversationHistory";
import { ToolManager } from "@/components/tools/ToolManager";
import { useUsage } from "@/hooks/useUsage";
import { cn } from "@/lib/utils";
import { useImpersonation } from "@/hooks/useImpersonation";

type Agent = DbAgent | MockAgent;

interface MainContentProps {
  selectedAgent: Agent | null;
  onMenuClick?: () => void;
  onClearChat: () => void;
}

interface Message {
  role: "user" | "assistant";
  content: string;
}

export const MainContent = ({ selectedAgent, onMenuClick, onClearChat }: MainContentProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [knowledgeSources, setKnowledgeSources] = useState<KnowledgeSource[]>([]);
  const [isEmbedDialogOpen, setIsEmbedDialogOpen] = useState(false);
  const [hasCopiedLink, setHasCopiedLink] = useState(false);
  const { usageInfo } = useUsage();
  const { isImpersonating } = useImpersonation();

  const plansWithTools = ['premium', 'agency'];
  const canUseTools = usageInfo && (plansWithTools.includes(usageInfo.plan) || usageInfo.role === 'admin');

  useEffect(() => {
    const fetchMessages = async () => {
      if (!selectedAgent) {
        setMessages([]);
        return;
      }

      setIsLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("messages")
        .select("role, content")
        .eq("agent_id", selectedAgent.id)
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });

      if (error) {
        showError("Error al cargar el historial del chat.");
        console.error(error);
      } else if (data) {
        setMessages(data as Message[]);
      }
      setIsLoading(false);
    };

    fetchMessages();
  }, [selectedAgent]);

  const handleSendMessage = async (prompt: string) => {
    if (!selectedAgent) return;
    if (knowledgeSources.length === 0) {
      showError("Por favor, añade al menos una fuente de conocimiento antes de chatear.");
      return;
    }

    const userMessage: Message = { role: "user", content: prompt };
    setMessages(prevMessages => [...prevMessages, userMessage]);
    setIsLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        showError("Usuario no autenticado. Por favor, inicia sesión de nuevo.");
        setIsLoading(false);
        return;
    }
    
    await supabase.from("messages").insert({
        agent_id: selectedAgent.id,
        user_id: user.id,
        role: "user",
        content: prompt,
    });

    setMessages(prev => [...prev, { role: "assistant", content: "" }]);

    try {
      const history = messages;
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sesión no encontrada.");

      const { data: responseText, error } = await supabase.functions.invoke('ask-agent', {
        headers: {
            Authorization: `Bearer ${session.access_token}`,
        },
        body: {
          agentId: selectedAgent.id,
          prompt,
          history,
        },
      });

      if (error) throw error;

      if (typeof responseText !== 'string') {
        console.error("Unexpected response format:", responseText);
        throw new Error("La respuesta del servidor no tuvo el formato esperado.");
      }
      
      const fullResponse = responseText;

      setMessages(prev => {
        const newMessages = [...prev];
        newMessages[newMessages.length - 1].content = fullResponse;
        return newMessages;
      });

      await supabase.from("messages").insert({
        agent_id: selectedAgent.id,
        user_id: user.id,
        role: "assistant",
        content: fullResponse,
      });

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

  const handleCopyLink = () => {
    if (!selectedAgent) return;
    const publicUrl = `${window.location.origin}/chat/${selectedAgent.id}`;
    navigator.clipboard.writeText(publicUrl);
    setHasCopiedLink(true);
    showSuccess("¡Enlace público copiado!");
    setTimeout(() => setHasCopiedLink(false), 2000);
  };

  return (
    <motion.main
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5, delay: 0.3 }}
      className="flex-1 flex flex-col h-screen relative min-w-0"
    >
      {onMenuClick && (
        <Button
          onClick={onMenuClick}
          variant="ghost"
          size="icon"
          className="absolute top-4 left-4 lg:hidden z-10 text-white"
        >
          <Menu className="w-6 h-6" />
        </Button>
      )}
      {selectedAgent ? (
        <>
          <div className="flex-1 flex flex-col lg:flex-row h-full overflow-hidden">
            <div className={cn(
              "flex-1 flex flex-col p-4 pt-16 lg:pt-6 lg:p-6 min-w-0",
              isImpersonating && "pb-28"
            )}>
              <header className="p-4 bg-black/20 backdrop-blur-lg border-b border-white/10 rounded-t-xl flex justify-between items-center gap-4">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  {'avatar_url' in selectedAgent && selectedAgent.avatar_url ? (
                    <img src={selectedAgent.avatar_url} alt={`${selectedAgent.name} logo`} className="w-12 h-12 rounded-full object-contain flex-shrink-0" />
                  ) : (
                    <div className="p-3 bg-white/10 rounded-full flex-shrink-0">
                      <Bot className="w-6 h-6 text-gray-300" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <h2 className="text-xl font-bold text-white truncate">{selectedAgent.name}</h2>
                    <p className="text-sm text-gray-400 truncate">{selectedAgent.description}</p>
                  </div>
                </div>
                <div id="tour-share-buttons" className="flex items-center gap-2 flex-shrink-0">
                  <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white" title="Limpiar historial de chat" onClick={onClearChat}>
                    <MessageSquareX className="w-5 h-5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white" title="Copiar enlace público" onClick={handleCopyLink}>
                    {hasCopiedLink ? <Check className="w-5 h-5 text-green-400" /> : <Copy className="w-5 h-5" />}
                  </Button>
                  <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white" title="Incrustar widget" onClick={() => setIsEmbedDialogOpen(true)}>
                    <Code className="w-5 h-5" />
                  </Button>
                  <Link to={`/agent/${selectedAgent.id}/edit`}>
                    <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white" title="Editar agente">
                      <Settings className="w-5 h-5" />
                    </Button>
                  </Link>
                </div>
              </header>
              <div id="tour-chat-input" className="flex-1 flex flex-col bg-black/10 rounded-b-xl overflow-hidden">
                <MessageList messages={messages} isLoading={isLoading} />
                <ChatInput onSendMessage={handleSendMessage} isLoading={isLoading} />
              </div>
            </div>
            <div id="tour-knowledge-panel" className="w-full lg:w-96 lg:flex-shrink-0 p-4 lg:p-6 flex flex-col">
              <Tabs defaultValue="knowledge" className="w-full flex-1 flex flex-col">
                <TabsList className={cn("grid w-full", canUseTools ? "grid-cols-3" : "grid-cols-2")}>
                  <TabsTrigger value="knowledge"><BookOpen className="w-4 h-4 mr-2" />Conocimiento</TabsTrigger>
                  {canUseTools && <TabsTrigger value="tools"><Zap className="w-4 h-4 mr-2" />Herramientas</TabsTrigger>}
                  <TabsTrigger value="conversations"><MessageCircle className="w-4 h-4 mr-2" />Conversaciones</TabsTrigger>
                </TabsList>
                <TabsContent value="knowledge" className="flex-1 mt-4">
                  <KnowledgeSourceManager agentId={selectedAgent.id} onSourcesChange={setKnowledgeSources} />
                </TabsContent>
                {canUseTools && (
                  <TabsContent value="tools" className="flex-1 mt-4">
                    <ToolManager />
                  </TabsContent>
                )}
                <TabsContent value="conversations" className="flex-1 mt-4">
                   <div className="flex-1 flex flex-col bg-black/20 backdrop-blur-lg border border-white/10 rounded-xl h-full">
                      <ConversationHistory agentId={selectedAgent.id} />
                   </div>
                </TabsContent>
              </Tabs>
            </div>
          </div>
          <EmbedDialog 
            open={isEmbedDialogOpen} 
            onOpenChange={setIsEmbedDialogOpen} 
            agentId={selectedAgent.id} 
          />
        </>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-center text-gray-400 pt-12 lg:pt-0">
          <Bot className="w-24 h-24 mb-4 text-gray-500" />
          <h2 className="text-2xl font-bold text-white">Bienvenido a tus Agentes</h2>
          <p className="mb-4">Selecciona un agente de la lista para comenzar a chatear.</p>
          <Button asChild>
            <Link to="/create-agent" className="text-white">
              Crear un nuevo agente
            </Link>
          </Button>
        </div>
      )}
    </motion.main>
  );
};