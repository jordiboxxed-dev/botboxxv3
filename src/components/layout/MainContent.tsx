import { Agent as DbAgent } from "./AppLayout";
import { Agent as MockAgent } from "@/data/mock-agents";
import { motion } from "framer-motion";
import { Bot, Settings, Trash2, Menu, Code, MessageCircle, BookOpen } from "lucide-react";
import { useState, useEffect } from "react";
import { MessageList } from "../chat/MessageList";
import { ChatInput } from "../chat/ChatInput";
import { supabase } from "@/integrations/supabase/client";
import { showError, showSuccess } from "@/utils/toast";
import { Button } from "@/components/ui/button";
import { Link, useNavigate } from "react-router-dom";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { KnowledgeSource, KnowledgeSourceManager } from "@/components/knowledge/KnowledgeSourceManager";
import { EmbedDialog } from "@/components/agents/EmbedDialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConversationHistory } from "@/components/agents/ConversationHistory";

type Agent = DbAgent | MockAgent;

interface MainContentProps {
  selectedAgent: Agent | null;
  onMenuClick?: () => void;
}

interface Message {
  role: "user" | "assistant";
  content: string;
}

export const MainContent = ({ selectedAgent, onMenuClick }: MainContentProps) => {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [knowledgeSources, setKnowledgeSources] = useState<KnowledgeSource[]>([]);
  const [isEmbedDialogOpen, setIsEmbedDialogOpen] = useState(false);

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
    const currentMessages = [...messages, userMessage];
    setMessages(currentMessages);
    setIsLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        showError("Usuario no encontrado.");
        setIsLoading(false);
        return;
    }
    
    await supabase.from("messages").insert({
        agent_id: selectedAgent.id,
        user_id: user.id,
        role: "user",
        content: prompt,
    });

    try {
      const systemPrompt = ('systemPrompt' in selectedAgent ? selectedAgent.systemPrompt : selectedAgent.system_prompt) || "Eres un asistente de IA servicial.";
      const history = currentMessages.slice(0, -1);

      const { data, error } = await supabase.functions.invoke("ask-gemini", {
        body: { 
          agentId: selectedAgent.id,
          prompt, 
          history, 
          systemPrompt 
        },
      });

      if (error) throw new Error(error.message);
      if (data.error) throw new Error(data.error);
      
      const assistantMessage: Message = { role: "assistant", content: data.response };
      setMessages((prev) => [...prev, assistantMessage]);

      await supabase.from("messages").insert({
        agent_id: selectedAgent.id,
        user_id: user.id,
        role: "assistant",
        content: data.response,
      });

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

  const handleDeleteAgent = async () => {
    if (!selectedAgent) return;
    const { error } = await supabase.from('agents').delete().eq('id', selectedAgent.id);
    if (error) {
      showError("Error al eliminar el agente: " + error.message);
    } else {
      showSuccess("Agente eliminado correctamente.");
      navigate('/dashboard');
    }
  };

  return (
    <motion.main
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5, delay: 0.3 }}
      className="flex-1 flex flex-col h-screen relative"
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
          <div className="flex-1 flex flex-col lg:flex-row h-full overflow-y-auto">
            <div className="flex-1 flex flex-col p-4 pt-16 lg:pt-6 lg:p-6">
              <header className="p-4 bg-black/20 backdrop-blur-lg border-b border-white/10 rounded-t-xl flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-bold text-white">{selectedAgent.name}</h2>
                  <p className="text-sm text-gray-400">{selectedAgent.description}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white" onClick={() => setIsEmbedDialogOpen(true)}>
                    <Code className="w-5 h-5" />
                  </Button>
                  <Link to={`/agent/${selectedAgent.id}/edit`}>
                    <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white">
                      <Settings className="w-5 h-5" />
                    </Button>
                  </Link>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="text-gray-400 hover:text-red-500">
                        <Trash2 className="w-5 h-5" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Esta acción no se puede deshacer. Esto eliminará permanentemente el agente y todos sus mensajes y fuentes de conocimiento asociadas.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteAgent} className="bg-red-600 hover:bg-red-700">
                          Eliminar
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </header>
              <div className="flex-1 flex flex-col bg-black/10 rounded-b-xl overflow-hidden">
                <MessageList messages={messages} isLoading={isLoading} />
                <ChatInput onSendMessage={handleSendMessage} isLoading={isLoading} />
              </div>
            </div>
            <div className="w-full lg:w-96 p-4 lg:p-6 flex flex-col">
              <Tabs defaultValue="knowledge" className="w-full flex-1 flex flex-col">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="knowledge"><BookOpen className="w-4 h-4 mr-2" />Conocimiento</TabsTrigger>
                  <TabsTrigger value="conversations"><MessageCircle className="w-4 h-4 mr-2" />Conversaciones</TabsTrigger>
                </TabsList>
                <TabsContent value="knowledge" className="flex-1 mt-4">
                  <KnowledgeSourceManager agentId={selectedAgent.id} onSourcesChange={setKnowledgeSources} />
                </TabsContent>
                <TabsContent value="conversations" className="flex-1 mt-2">
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