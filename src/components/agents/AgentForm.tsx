import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { showError } from "@/utils/toast";
import { Loader2 } from "lucide-react";
import { Agent } from "@/components/layout/AppLayout";

interface AgentFormProps {
  onSubmit: (agentData: Omit<Agent, 'id' | 'user_id' | 'created_at'>) => Promise<void>;
  isLoading: boolean;
  initialData?: Partial<Agent>;
  submitButtonText?: string;
}

export const AgentForm = ({ onSubmit, isLoading, initialData, submitButtonText = "Crear Agente" }: AgentFormProps) => {
  const navigate = useNavigate();
  
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  
  useEffect(() => {
    if (initialData) {
      setName(initialData.name || "");
      setDescription(initialData.description || "");
      setCompanyName(initialData.company_name || "");
      setSystemPrompt(initialData.system_prompt || "");
    }
  }, [initialData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !systemPrompt) {
      showError("El nombre del agente y las instrucciones base son obligatorios.");
      return;
    }
    await onSubmit({ name, description, company_name: companyName, system_prompt: systemPrompt });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <Label htmlFor="name" className="text-white">Nombre del Agente</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Asistente de Soporte" className="bg-black/20 border-white/20 text-white mt-2" />
        </div>
        <div>
          <Label htmlFor="companyName" className="text-white">Nombre de la Empresa</Label>
          <Input id="companyName" value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Ej: Mi Negocio S.A." className="bg-black/20 border-white/20 text-white mt-2" />
        </div>
      </div>
      <div>
        <Label htmlFor="description" className="text-white">Descripción Corta</Label>
        <Input id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="¿Cuál es el propósito principal de este agente?" className="bg-black/20 border-white/20 text-white mt-2" />
      </div>
      <div>
        <Label htmlFor="systemPrompt" className="text-white">Instrucciones Base / Personalidad</Label>
        <Textarea id="systemPrompt" value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value)} placeholder="Ej: Eres un asistente amigable y servicial. Tu objetivo es..." className="bg-black/20 border-white/20 text-white mt-2 min-h-[120px]" />
      </div>
      
      <div className="flex justify-end gap-4 pt-4">
        <Button type="button" variant="outline" onClick={() => navigate(-1)} className="border-white/20 text-white hover:bg-white/10">
          Cancelar
        </Button>
        <Button type="submit" disabled={isLoading} className="bg-blue-600 hover:bg-blue-700 text-white">
          {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Procesando...</> : submitButtonText}
        </Button>
      </div>
    </form>
  );
};