import { Agent as DbAgent } from "./AppLayout";
import { Agent as MockAgent } from "@/data/mock-agents";
import { motion } from "framer-motion";
import { Bot, Info, Link, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { MessageList } from "../chat/MessageList";
import { ChatInput } from "../chat/ChatInput";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { showError, showSuccess } from "@/utils/toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type Agent = DbAgent | MockAgent;

interface MainContentProps {
  selectedAgent: Agent | null;
}

interface Message {
  role: "user" | "assistant";
  content: string;
}

export const MainContent = ({ selectedAgent }: MainContentProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [businessContext, setBusinessContext] = useState("");
  const [url, setUrl] = useState("");
  const [isFetchingUrl, setIsFetchingUrl] = useState(false);

  useEffect(() => {
    // Cuando el agente cambia, reseteamos el chat y el contexto
    setMessages([]);
    const initialContext = selectedAgent && 'business_context' in selectedAgent 
      ? selectedAgent.business_context || "" 
      : "";
    setBusinessContext(initialContext);
  }, [selectedAgent]);

  const handleFetchUrl = async () => {
    if (!url.trim()) {
      showError("Por favor, introduce una URL válida.");
      return;
    }
    setIsFetchingUrl(true);
    try {
      const { data, error } = await supabase.functions.invoke("fetch-url-content", {
        body: { url },
      });

      if (error) throw new Error(error.message);
      if (data.error) throw new Error(data.error);

      setBusinessContext(prev => `${prev}\n\n--- Contenido de ${url} ---\n${data.content}`.trim());
      showSuccess("Contenido de la URL importado correctamente.");
      setUrl("");
    } catch (err) {
      console.error(err);
      showError("No se pudo importar el contenido de la URL.");
    } finally {
      setIsFetchingUrl(false);
    }
  };

  const handleSendMessage = async (prompt: string) => {
    if (!selectedAgent) return;
    if (!businessContext.trim()) {
      showError("Por favor, añade información en el contexto de negocio antes de chatear.");
      return;
    }

    const userMessage: Message = { role: "user", content: prompt };
    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const systemPrompt = ('systemPrompt' in selectedAgent ? selectedAgent.systemPrompt : selectedAgent.system_prompt) || "Eres un asistente de IA servicial.";
      const { data, error } = await supabase.functions.invoke("ask-gemini", {
        body: { prompt, context: businessContext, systemPrompt },
      });

      if (error) throw new Error(error.message);
      if (data.error) throw new Error(data.error);
      
      const assistantMessage: Message = { role: "assistant", content: data.response };
      setMessages((prev) => [...prev, assistantMessage]);

    } catch (err) {
      console.error(err);
      showError("Hubo un error al contactar al agente. Revisa la consola para más detalles.");
      const errorMessage: Message = { role: "assistant", content: "Lo siento, no pude procesar tu solicitud." };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.main
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5, delay: 0.3 }}
      className="flex-1 flex flex-col h-screen"
    >
      {selectedAgent ? (
        <div className="flex-1 flex flex-row h-full">
          <div className="flex-1 flex flex-col p-6">
            <header className="p-4 bg-black/20 backdrop-blur-lg border-b border-white/10 rounded-t-xl">
              <h2 className="text-xl font-bold text-white">{selectedAgent.name}</h2>
              <p className="text-sm text-gray-400">{selectedAgent.description}</p>
            </header>
            <div className="flex-1 flex flex-col bg-black/10 rounded-b-xl overflow-hidden">
              <MessageList messages={messages} isLoading={isLoading} />
              <ChatInput onSendMessage={handleSendMessage} isLoading={isLoading} />
            </div>
          </div>
          <div className="w-80 p-6 flex flex-col">
             <div className="flex-1 flex flex-col bg-black/20 backdrop-blur-lg border border-white/10 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                    <Info className="w-5 h-5 text-gray-400" />
                    <h3 className="text-lg font-semibold text-white">Contexto de Negocio</h3>
                </div>
                
                <div className="flex items-center gap-2 mb-2">
                    <Input 
                        type="url"
                        placeholder="Importar desde URL"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        className="bg-black/30 border-white/20 text-white placeholder:text-gray-500"
                    />
                    <Button onClick={handleFetchUrl} disabled={isFetchingUrl} size="icon" variant="ghost">
                        {isFetchingUrl ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link className="w-4 h-4" />}
                    </Button>
                </div>

                <p className="text-xs text-gray-500 mb-4 text-center">
                    Pega una URL para extraer su texto o escribe/pega el contexto directamente abajo.
                </p>

                <Textarea 
                    value={businessContext}
                    onChange={(e) => setBusinessContext(e.target.value)}
                    placeholder="Ej: Nombre de la empresa, productos, horarios, políticas de devolución..."
                    className="flex-1 bg-black/30 border-white/20 text-white placeholder:text-gray-500 rounded-lg resize-none"
                />
             </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-center text-gray-400">
          <Bot className="w-24 h-24 mb-4 text-gray-500" />
          <h2 className="text-2xl font-bold text-white">Bienvenido a tus Agentes</h2>
          <p>Selecciona un agente de la lista para comenzar a chatear.</p>
          <p className="text-sm mt-4">O <Link to="/create-agent" className="text-blue-400 underline">crea uno nuevo</Link>.</p>
        </div>
      )}
    </motion.main>
  );
};