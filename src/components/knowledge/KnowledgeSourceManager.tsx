import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { showError, showSuccess } from "@/utils/toast";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Info, Plus, Trash2, FileText, Link as LinkIcon, FileUp, Globe } from "lucide-react";
import { AddSourceDialog } from "@/components/knowledge/AddSourceDialog";
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

export interface KnowledgeSource {
  id: string;
  name: string;
  type: "text" | "url" | "file" | "website";
  created_at: string;
}

interface KnowledgeSourceManagerProps {
  agentId: string;
  onSourcesChange: (sources: KnowledgeSource[]) => void;
}

export const KnowledgeSourceManager = ({ agentId, onSourcesChange }: KnowledgeSourceManagerProps) => {
  const [sources, setSources] = useState<KnowledgeSource[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  const fetchSources = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("knowledge_sources")
      .select("id, name, type, created_at")
      .eq("agent_id", agentId)
      .order("created_at", { ascending: false });

    if (error) {
      showError("Error al cargar las fuentes de conocimiento.");
      console.error(error);
    } else {
      setSources(data as KnowledgeSource[]);
      onSourcesChange(data as KnowledgeSource[]);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    if (agentId) {
      fetchSources();
    }
  }, [agentId]);

  const handleDeleteSource = async (sourceId: string) => {
    // La eliminación en cascada se encargará de los chunks
    const { error } = await supabase.from("knowledge_sources").delete().eq("id", sourceId);
    if (error) {
      showError("Error al eliminar la fuente: " + error.message);
    } else {
      showSuccess("Fuente de conocimiento eliminada.");
      fetchSources();
    }
  };

  const getIconForType = (type: string) => {
    switch (type) {
      case 'url': return <LinkIcon className="w-4 h-4 text-gray-400" />;
      case 'file': return <FileUp className="w-4 h-4 text-gray-400" />;
      case 'website': return <Globe className="w-4 h-4 text-gray-400" />;
      default: return <FileText className="w-4 h-4 text-gray-400" />;
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-black/20 backdrop-blur-lg border border-white/10 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Info className="w-5 h-5 text-gray-400" />
          <h3 className="text-lg font-semibold text-white">Conocimiento</h3>
        </div>
        <Button size="sm" onClick={() => setIsAddDialogOpen(true)}>
          <Plus className="w-4 h-4 mr-2" /> Añadir
        </Button>
      </div>
      
      <div className="flex-1 space-y-2 overflow-y-auto pr-1">
        {isLoading ? (
          [...Array(3)].map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-md" />)
        ) : sources.length > 0 ? (
          sources.map(source => (
            <div key={source.id} className="flex items-center justify-between bg-black/30 p-2 rounded-md">
              <div className="flex-1 flex items-center gap-3 overflow-hidden">
                {getIconForType(source.type)}
                <span className="text-sm text-white truncate" title={source.name}>{source.name}</span>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-red-500 flex-shrink-0 ml-2">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>¿Eliminar esta fuente?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Esta acción es permanente y eliminará "{source.name}" y todo su conocimiento procesado del agente.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={() => handleDeleteSource(source.id)} className="bg-red-600 hover:bg-red-700">
                      Eliminar
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          ))
        ) : (
          <div className="text-center text-sm text-gray-500 py-8">
            Este agente aún no tiene conocimiento. <br /> Añade una fuente para empezar.
          </div>
        )}
      </div>

      <AddSourceDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        agentId={agentId}
        onSourceAdded={fetchSources}
      />
    </div>
  );
};