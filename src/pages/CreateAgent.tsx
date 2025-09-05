import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { showError, showSuccess } from "@/utils/toast";
import { Loader2 } from "lucide-react";

const CreateAgent = () => {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [businessContext, setBusinessContext] = useState("");
  const [isLoading, setIsLoading] = useState(false);

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
      <div className="w-full max-w-2xl mx-auto bg-black/30 border border-white/10 rounded-2xl p-8 shadow-2xl">
        <h1 className="text-3xl font-bold text-white mb-2">Crear Nuevo Agente</h1>
        <p className="text-gray-400 mb-6">Dale vida a tu asistente de IA personalizado.</p>
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
          <div>
            <Label htmlFor="businessContext" className="text-white">Contexto de Negocio Inicial (Opcional)</Label>
            <Textarea id="businessContext" value={businessContext} onChange={(e) => setBusinessContext(e.target.value)} placeholder="Pega aquí información clave sobre tu negocio: productos, servicios, horarios, etc." className="bg-black/20 border-white/20 mt-2 min-h-[150px]" />
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={isLoading}>
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isLoading ? "Creando..." : "Crear Agente"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateAgent;