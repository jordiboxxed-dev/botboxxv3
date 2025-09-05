import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { showError, showSuccess } from "@/utils/toast";
import { Loader2, Link as LinkIcon, FileUp } from "lucide-react";
import { motion } from "framer-motion";

const CreateAgent = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [businessContext, setBusinessContext] = useState("");
  
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingUrl, setIsFetchingUrl] = useState(false);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [url, setUrl] = useState("");

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
      showSuccess("Contenido de la URL importado.");
      setUrl("");
    } catch (err) {
      console.error(err);
      showError((err as Error).message || "No se pudo importar el contenido de la URL.");
    } finally {
      setIsFetchingUrl(false);
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploadingFile(true);
    try {
      // Read file as ArrayBuffer
      const arrayBuffer = await file.arrayBuffer();
      
      // Send as binary data with proper content-type header
      const { data, error } = await supabase.functions.invoke("extract-text-from-file", {
        body: arrayBuffer,
        headers: {
          "Content-Type": file.type || "application/octet-stream"
        }
      });

      if (error) throw new Error(error.message);
      if (data.error) throw new Error(data.error);

      setBusinessContext(prev => `${prev}\n\n--- Contenido de ${file.name} ---\n${data.content}`.trim());
      showSuccess(`Contenido de ${file.name} importado.`);
    } catch (err) {
      console.error(err);
      showError((err as Error).message || "No se pudo procesar el archivo.");
    } finally {
      setIsUploadingFile(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = ""; // Reset file input
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !systemPrompt) {
      showError("El nombre del agente y las instrucciones base son obligatorios.");
      return;
    }
    setIsLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        showError("No se pudo identificar al usuario. Por favor, inicia sesión de nuevo.");
        setIsLoading(false);
        return;
    }

    const { data, error } = await supabase
      .from("agents")
      .insert({
        user_id: user.id,
        name,
        description,
        company_name: companyName,
        system_prompt: systemPrompt,
        business_context: businessContext,
      })
      .select()
      .single();

    setIsLoading(false);

    if (error) {
      showError("Error al crear el agente: " + error.message);
    } else if (data) {
      showSuccess("¡Agente creado con éxito!");
      navigate(`/agent/${data.id}`);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 p-4">
      <div className="w-full max-w-3xl mx-auto bg-black/30 border border-white/10 rounded-2xl p-8 shadow-2xl">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <h1 className="text-3xl font-bold text-white mb-2">Crear Nuevo Agente</h1>
          <p className="text-gray-400 mb-8">Dale vida a tu asistente de IA personalizado.</p>
        </motion.div>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Label htmlFor="name" className="text-white">Nombre del Agente</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Asistente de Soporte" className="bg-black/20 border-white/20 mt-2" />
            </div>
            <div>
              <Label htmlFor="companyName" className="text-white">Nombre de la Empresa</Label>
              <Input id="companyName" value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Ej: Mi Negocio S.A." className="bg-black/20 border-white/20 mt-2" />
            </div>
          </div>
          <div>
            <Label htmlFor="description" className="text-white">Descripción Corta</Label>
            <Input id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="¿Cuál es el propósito principal de este agente?" className="bg-black/20 border-white/20 mt-2" />
          </div>
          <div>
            <Label htmlFor="systemPrompt" className="text-white">Instrucciones Base / Personalidad</Label>
            <Textarea id="systemPrompt" value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value)} placeholder="Ej: Eres un asistente amigable y servicial. Tu objetivo es..." className="bg-black/20 border-white/20 mt-2 min-h-[120px]" />
          </div>
          
          <div className="space-y-4">
            <Label className="text-white">Contexto de Negocio</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="context-importer">
                <div className="flex items-center gap-2">
                  <Input type="url" placeholder="Importar desde URL" value={url} onChange={(e) => setUrl(e.target.value)} className="bg-black/30 border-white/20 text-white placeholder:text-gray-500 flex-1" disabled={isFetchingUrl} />
                  <Button type="button" onClick={handleFetchUrl} disabled={isFetchingUrl} size="icon" variant="ghost">
                    {isFetchingUrl ? <Loader2 className="w-4 h-4 animate-spin" /> : <LinkIcon className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
              <div className="context-importer">
                <label className="flex items-center justify-center gap-2 cursor-pointer text-white h-full">
                  {isUploadingFile ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileUp className="w-5 h-5" />}
                  <span>Cargar Documento</span>
                  <input 
                    type="file" 
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept=".pdf,.docx,.txt,text/*"
                    className="hidden" 
                  />
                </label>
              </div>
            </div>
            
            <Textarea 
              value={businessContext}
              onChange={(e) => setBusinessContext(e.target.value)}
              placeholder="Información sobre tu negocio, productos, servicios, políticas, etc."
              className="bg-black/30 border-white/20 text-white placeholder:text-gray-500 min-h-[120px]"
            />
          </div>
          
          <div className="flex justify-end gap-4 pt-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => navigate('/dashboard')}
              className="border-white/20 text-white hover:bg-white/10"
            >
              Cancelar
            </Button>
            <Button 
              type="submit" 
              disabled={isLoading}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creando...
                </>
              ) : "Crear Agente"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateAgent;