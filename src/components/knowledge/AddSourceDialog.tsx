import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, FileUp, Link as LinkIcon, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { showError, showSuccess } from "@/utils/toast";

type SourceType = "text" | "url" | "file";

interface AddSourceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentId: string;
  onSourceAdded: () => void;
}

export const AddSourceDialog = ({ open, onOpenChange, agentId, onSourceAdded }: AddSourceDialogProps) => {
  const [sourceType, setSourceType] = useState<SourceType | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [name, setName] = useState("");
  const [textContent, setTextContent] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetState = () => {
    setSourceType(null);
    setIsLoading(false);
    setName("");
    setTextContent("");
    setStatusMessage("");
  };

  const handleClose = () => {
    if (isLoading) return;
    resetState();
    onOpenChange(false);
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setStatusMessage("Extrayendo texto del archivo...");
    setName(file.name);
    try {
      const blob = new Blob([file], { type: file.type });
      const { data, error } = await supabase.functions.invoke("extract-text-from-file", {
        body: blob,
        headers: { "Content-Type": file.type || "application/octet-stream" }
      });

      if (error) throw new Error(error.message);
      if (data.error) throw new Error(data.error);
      
      setTextContent(data.content);
      showSuccess(`Contenido de ${file.name} extraído.`);
    } catch (err) {
      showError((err as Error).message || "No se pudo procesar el archivo.");
      resetState();
    } finally {
      setIsLoading(false);
      setStatusMessage("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleUrlFetch = async () => {
    if (!textContent.trim()) {
      showError("Por favor, introduce una URL válida.");
      return;
    }
    setIsLoading(true);
    setStatusMessage("Importando contenido de la URL...");
    try {
      const { data, error } = await supabase.functions.invoke("fetch-url-content", { body: { url: textContent } });
      if (error) throw new Error(error.message);
      if (data.error) throw new Error(data.error);
      
      setTextContent(data.content);
      setName(new URL(textContent).hostname);
      showSuccess("Contenido de la URL importado.");
    } catch (err) {
      showError((err as Error).message || "No se pudo importar el contenido de la URL.");
    } finally {
      setIsLoading(false);
      setStatusMessage("");
    }
  };

  const handleSubmit = async () => {
    if (!name || !textContent || !sourceType) {
      showError("El nombre y el contenido son obligatorios.");
      return;
    }
    setIsLoading(true);
    setStatusMessage("Guardando fuente de conocimiento...");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        showError("Usuario no autenticado.");
        setIsLoading(false);
        return;
    }

    // 1. Crear la fuente de conocimiento (sin el contenido)
    const { data: sourceData, error: sourceError } = await supabase.from("knowledge_sources").insert({
        user_id: user.id,
        agent_id: agentId,
        name,
        type: sourceType,
    }).select().single();

    if (sourceError) {
        setIsLoading(false);
        showError("Error al guardar la fuente: " + sourceError.message);
        return;
    }

    // 2. Llamar a la función de embedding
    setStatusMessage("Procesando y generando embeddings...");
    try {
      const { error: embedError } = await supabase.functions.invoke("embed-and-store", {
        body: { sourceId: sourceData.id, textContent },
      });

      if (embedError) throw new Error(embedError.message);

      showSuccess("Fuente de conocimiento añadida y procesada.");
      onSourceAdded();
      handleClose();
    } catch (err) {
      showError("Error al procesar el conocimiento: " + (err as Error).message);
      // Opcional: eliminar la fuente creada si el embedding falla
      await supabase.from("knowledge_sources").delete().eq("id", sourceData.id);
    } finally {
      setIsLoading(false);
      setStatusMessage("");
    }
  };

  const renderContent = () => {
    if (!sourceType) {
      return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 py-4">
          <Button variant="outline" className="h-24 flex-col gap-2" onClick={() => setSourceType("text")}><FileText />Texto Plano</Button>
          <Button variant="outline" className="h-24 flex-col gap-2" onClick={() => setSourceType("url")}><LinkIcon />Desde URL</Button>
          <Button variant="outline" className="h-24 flex-col gap-2" onClick={() => setSourceType("file")}><FileUp />Subir Archivo</Button>
        </div>
      );
    }

    return (
      <div className="space-y-4 py-4">
        <div>
          <Label htmlFor="source-name">Nombre de la Fuente</Label>
          <Input id="source-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Política de Devoluciones" />
        </div>
        {sourceType === "text" && (
          <div>
            <Label htmlFor="source-content">Contenido</Label>
            <Textarea id="source-content" value={textContent} onChange={(e) => setTextContent(e.target.value)} className="min-h-[150px]" />
          </div>
        )}
        {sourceType === "url" && (
          <div>
            <Label htmlFor="source-url">URL</Label>
            <div className="flex items-center gap-2">
              <Input id="source-url" type="url" value={textContent} onChange={(e) => setTextContent(e.target.value)} placeholder="https://ejemplo.com/info" />
              <Button onClick={handleUrlFetch} disabled={isLoading} size="icon">
                {isLoading ? <Loader2 className="animate-spin" /> : <LinkIcon />}
              </Button>
            </div>
          </div>
        )}
        {sourceType === "file" && (
          <div>
            <Label>Archivo</Label>
            <Input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".pdf,.docx,.txt,text/*" className="text-gray-400 file:text-white" />
            {textContent && <p className="text-sm text-gray-400 mt-2">Contenido extraído. Puedes editar el nombre si lo deseas.</p>}
          </div>
        )}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{sourceType ? `Añadir ${sourceType}` : "Añadir Fuente de Conocimiento"}</DialogTitle>
          <DialogDescription>
            {sourceType ? "Completa los detalles de tu nueva fuente de conocimiento." : "Selecciona el tipo de fuente que quieres añadir."}
          </DialogDescription>
        </DialogHeader>
        {renderContent()}
        {isLoading && <div className="text-center text-sm text-blue-300 flex items-center justify-center gap-2"><Loader2 className="animate-spin w-4 h-4" /> {statusMessage}</div>}
        <DialogFooter>
          {sourceType && <Button variant="ghost" onClick={() => setSourceType(null)} disabled={isLoading}>Atrás</Button>}
          <Button onClick={handleClose} variant="outline" disabled={isLoading}>Cancelar</Button>
          {sourceType && <Button onClick={handleSubmit} disabled={isLoading || !textContent || !name}>
            {isLoading ? <Loader2 className="animate-spin" /> : "Guardar y Procesar"}
          </Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};