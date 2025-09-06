import { useState, useEffect } from "react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, PlusCircle, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { showError, showSuccess } from "@/utils/toast";

export interface AgentTool {
  id?: string;
  name: string;
  description: string;
  parameters: any;
  endpoint_url: string;
}

interface AddToolDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentId: string;
  onToolAdded: () => void;
  initialData?: AgentTool | null;
}

interface Parameter {
  id: number;
  name: string;
  type: 'string' | 'number' | 'boolean';
  description: string;
  required: boolean;
}

export const AddToolDialog = ({ open, onOpenChange, agentId, onToolAdded, initialData }: AddToolDialogProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [endpointUrl, setEndpointUrl] = useState("");
  const [parameters, setParameters] = useState<Parameter[]>([]);

  useEffect(() => {
    if (initialData) {
      setName(initialData.name);
      setDescription(initialData.description);
      setEndpointUrl(initialData.endpoint_url);
      // Convertir JSON Schema a nuestro estado de UI
      const parsedParams: Parameter[] = [];
      if (initialData.parameters?.properties) {
        Object.keys(initialData.parameters.properties).forEach((key, index) => {
          parsedParams.push({
            id: index,
            name: key,
            type: initialData.parameters.properties[key].type,
            description: initialData.parameters.properties[key].description,
            required: initialData.parameters.required?.includes(key) || false,
          });
        });
      }
      setParameters(parsedParams);
    } else {
      // Resetear para el modo 'crear'
      setName("");
      setDescription("");
      setEndpointUrl("");
      setParameters([]);
    }
  }, [initialData, open]);

  const handleAddParameter = () => {
    setParameters([...parameters, { id: Date.now(), name: "", type: "string", description: "", required: false }]);
  };

  const handleRemoveParameter = (id: number) => {
    setParameters(parameters.filter(p => p.id !== id));
  };

  const handleParameterChange = (id: number, field: keyof Omit<Parameter, 'id'>, value: string | boolean) => {
    setParameters(parameters.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  const handleSubmit = async () => {
    if (!name || !description || !endpointUrl) {
      showError("Nombre, descripción y URL del endpoint son obligatorios.");
      return;
    }
    setIsLoading(true);

    // Convertir nuestro estado de UI a JSON Schema
    const properties = parameters.reduce((acc, p) => {
      if (p.name) {
        acc[p.name] = { type: p.type, description: p.description };
      }
      return acc;
    }, {} as any);

    const required = parameters.filter(p => p.required && p.name).map(p => p.name);

    const toolData = {
      agent_id: agentId,
      name,
      description,
      endpoint_url: endpointUrl,
      parameters: {
        type: "object",
        properties,
        required,
      },
    };

    try {
      let error;
      if (initialData?.id) {
        // Actualizar
        const { error: updateError } = await supabase.from("agent_tools").update(toolData).eq("id", initialData.id);
        error = updateError;
      } else {
        // Insertar
        const { error: insertError } = await supabase.from("agent_tools").insert(toolData);
        error = insertError;
      }

      if (error) throw error;

      showSuccess(initialData?.id ? "Herramienta actualizada con éxito" : "Herramienta creada con éxito");
      onToolAdded();
      onOpenChange(false);
    } catch (err) {
      showError("Error al guardar la herramienta: " + (err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{initialData ? "Editar Herramienta" : "Añadir Nueva Herramienta"}</DialogTitle>
          <DialogDescription>
            Define una acción que tu agente puede realizar. La descripción es clave para que la IA sepa cuándo usarla.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto pr-4">
          <div className="space-y-2">
            <Label htmlFor="tool-name">Nombre de la Herramienta</Label>
            <Input id="tool-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="ej: agendar_cita (sin espacios)" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tool-desc">Descripción</Label>
            <Textarea id="tool-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="ej: Usa esta herramienta para agendar una cita en el calendario del cliente." className="min-h-[80px]" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tool-endpoint">URL del Endpoint</Label>
            <Input id="tool-endpoint" value={endpointUrl} onChange={(e) => setEndpointUrl(e.target.value)} placeholder="URL de la Edge Function a ejecutar" />
          </div>
          
          <div className="pt-4 border-t border-white/10">
            <h4 className="font-semibold mb-2">Parámetros</h4>
            <div className="space-y-3">
              {parameters.map((param, index) => (
                <div key={param.id} className="grid grid-cols-12 gap-2 items-center bg-black/20 p-3 rounded-md">
                  <Input placeholder="nombre" value={param.name} onChange={(e) => handleParameterChange(param.id, 'name', e.target.value)} className="col-span-3" />
                  <Select value={param.type} onValueChange={(value) => handleParameterChange(param.id, 'type', value)}>
                    <SelectTrigger className="col-span-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="string">Texto</SelectItem>
                      <SelectItem value="number">Número</SelectItem>
                      <SelectItem value="boolean">Sí/No</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input placeholder="Descripción" value={param.description} onChange={(e) => handleParameterChange(param.id, 'description', e.target.value)} className="col-span-5" />
                  <div className="col-span-1 flex items-center justify-center">
                    <Checkbox checked={param.required} onCheckedChange={(checked) => handleParameterChange(param.id, 'required', !!checked)} title="Requerido" />
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => handleRemoveParameter(param.id)} className="col-span-1 h-8 w-8 text-gray-400 hover:text-red-500">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
            <Button variant="outline" size="sm" onClick={handleAddParameter} className="mt-3">
              <PlusCircle className="w-4 h-4 mr-2" /> Añadir Parámetro
            </Button>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)} variant="outline" disabled={isLoading}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={isLoading}>
            {isLoading ? <Loader2 className="animate-spin" /> : "Guardar Herramienta"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};