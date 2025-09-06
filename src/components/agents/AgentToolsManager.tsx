import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { showError, showSuccess } from "@/utils/toast";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Wrench, Plus, Trash2, Edit, Hammer } from "lucide-react";
import { AddToolDialog, AgentTool } from "./AddToolDialog";
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

interface AgentToolsManagerProps {
  agentId: string;
}

export const AgentToolsManager = ({ agentId }: AgentToolsManagerProps) => {
  const [tools, setTools] = useState<AgentTool[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTool, setEditingTool] = useState<AgentTool | null>(null);

  const fetchTools = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("agent_tools")
      .select("*")
      .eq("agent_id", agentId)
      .order("created_at", { ascending: false });

    if (error) {
      showError("Error al cargar las herramientas.");
      console.error(error);
    } else {
      setTools(data as AgentTool[]);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    if (agentId) {
      fetchTools();
    }
  }, [agentId]);

  const handleOpenDialog = (tool: AgentTool | null = null) => {
    setEditingTool(tool);
    setIsDialogOpen(true);
  };

  const handleDeleteTool = async (toolId: string) => {
    const { error } = await supabase.from("agent_tools").delete().eq("id", toolId);
    if (error) {
      showError("Error al eliminar la herramienta: " + error.message);
    } else {
      showSuccess("Herramienta eliminada.");
      fetchTools();
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-black/20 backdrop-blur-lg border border-white/10 rounded-xl p-4 h-full">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Wrench className="w-5 h-5 text-gray-400" />
          <h3 className="text-lg font-semibold text-white">Herramientas</h3>
        </div>
        <Button size="sm" onClick={() => handleOpenDialog()}>
          <Plus className="w-4 h-4 mr-2" /> Añadir
        </Button>
      </div>
      
      <div className="flex-1 space-y-2 overflow-y-auto pr-1">
        {isLoading ? (
          [...Array(2)].map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-md" />)
        ) : tools.length > 0 ? (
          tools.map(tool => (
            <div key={tool.id} className="flex items-center justify-between bg-black/30 p-3 rounded-md">
              <div className="flex items-center gap-3 overflow-hidden">
                <Hammer className="w-5 h-5 text-gray-400 flex-shrink-0" />
                <div className="flex-1 overflow-hidden">
                  <p className="text-sm text-white font-semibold truncate" title={tool.name}>{tool.name}</p>
                  <p className="text-xs text-gray-500 truncate" title={tool.description}>{tool.description}</p>
                </div>
              </div>
              <div className="flex items-center flex-shrink-0">
                <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-blue-400" onClick={() => handleOpenDialog(tool)}>
                  <Edit className="w-4 h-4" />
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-red-500">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>¿Eliminar esta herramienta?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Esta acción es permanente y eliminará la herramienta "{tool.name}" del agente.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleDeleteTool(tool.id!)} className="bg-red-600 hover:bg-red-700">
                        Eliminar
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center text-sm text-gray-500 py-8">
            Este agente no tiene herramientas. <br /> Añade una para darle nuevas habilidades.
          </div>
        )}
      </div>

      <AddToolDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        agentId={agentId}
        onToolAdded={fetchTools}
        initialData={editingTool}
      />
    </div>
  );
};