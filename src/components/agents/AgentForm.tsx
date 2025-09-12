import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { showError } from "@/utils/toast";
import { Loader2, Zap } from "lucide-react";
import { Agent } from "@/components/layout/AppLayout";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface AgentFormProps {
  onSubmit: (agentData: Omit<Agent, 'id' | 'user_id' | 'created_at' | 'deleted_at'>) => Promise<void>;
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
  const [widgetColor, setWidgetColor] = useState("#3b82f6");
  const [widgetWelcomeMessage, setWidgetWelcomeMessage] = useState("¡Hola! ¿Cómo puedo ayudarte hoy?");
  const [widgetPosition, setWidgetPosition] = useState("right");
  const [status, setStatus] = useState("active");
  const [model, setModel] = useState("mistralai/mistral-7b-instruct");
  const [webhookUrl, setWebhookUrl] = useState("https://n8n.srv945931.hstgr.cloud/webhook/agente-ventas");
  
  useEffect(() => {
    if (initialData) {
      setName(initialData.name || "");
      setDescription(initialData.description || "");
      setCompanyName(initialData.company_name || "");
      setSystemPrompt(initialData.system_prompt || "");
      setWidgetColor(initialData.widget_color || "#3b82f6");
      setWidgetWelcomeMessage(initialData.widget_welcome_message || "¡Hola! ¿Cómo puedo ayudarte hoy?");
      setWidgetPosition(initialData.widget_position || "right");
      setStatus(initialData.status || "active");
      setModel(initialData.model || "mistralai/mistral-7b-instruct");
      if (initialData.webhook_url !== null && initialData.webhook_url !== undefined) {
        setWebhookUrl(initialData.webhook_url);
      }
    }
  }, [initialData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) {
      showError("El nombre del agente es obligatorio.");
      return;
    }
    if (!systemPrompt && !webhookUrl) {
      showError("Debes proporcionar Instrucciones Base o una URL de Webhook.");
      return;
    }
    await onSubmit({ 
      name, 
      description, 
      company_name: companyName, 
      system_prompt: systemPrompt,
      widget_color: widgetColor,
      widget_welcome_message: widgetWelcomeMessage,
      widget_position: widgetPosition,
      status,
      model,
      webhook_url: webhookUrl,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <h3 className="text-xl font-semibold text-white mb-4">Información Básica</h3>
        <div className="space-y-6">
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
            <p className="text-xs text-gray-400 mt-2">
              Define el comportamiento del agente. Se ignora si se usa un Webhook.
            </p>
          </div>
          <div>
            <Label htmlFor="model" className="text-white">Modelo de IA</Label>
            <Select value={model} onValueChange={setModel}>
              <SelectTrigger id="model" className="bg-black/20 border-white/20 text-white mt-2">
                <SelectValue placeholder="Selecciona un modelo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mistralai/mistral-7b-instruct">Mistral 7B Instruct (Rápido y Económico)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-400 mt-2">
              Elige el motor de IA. Se ignora si se usa un Webhook.
            </p>
          </div>
        </div>
      </div>

      <div className="pt-6 border-t border-white/10">
        <h3 className="text-xl font-semibold text-white mb-2 flex items-center gap-2"><Zap className="w-5 h-5 text-yellow-400"/> Integración con Webhook</h3>
        <p className="text-gray-400 mb-4">Conecta tu agente a un servicio externo como n8n o Zapier para una lógica personalizada.</p>
        <div>
          <Label htmlFor="webhookUrl" className="text-white">Webhook URL</Label>
          <Input id="webhookUrl" value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)} placeholder="https://tu-webhook.com/endpoint" className="bg-black/20 border-white/20 text-white mt-2" />
          <p className="text-xs text-gray-400 mt-2">
            Si completas este campo, el agente enviará los datos a esta URL en lugar de usar el modelo de IA interno.
          </p>
        </div>
      </div>
      
      <div className="pt-6 border-t border-white/10">
        <h3 className="text-xl font-semibold text-white mb-2">Personalización del Widget</h3>
        <p className="text-gray-400 mb-6">Ajusta cómo se verá y comportará el chat en tu sitio web.</p>
        
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Label htmlFor="widgetColor" className="text-white">Color Principal</Label>
              <div className="relative mt-2">
                <Input 
                  id="widgetColor" 
                  type="color" 
                  value={widgetColor} 
                  onChange={(e) => setWidgetColor(e.target.value)} 
                  className="w-full h-10 p-1"
                />
              </div>
            </div>
            <div>
              <Label className="text-white">Posición del Widget</Label>
              <RadioGroup 
                value={widgetPosition} 
                onValueChange={setWidgetPosition} 
                className="mt-3 flex items-center gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="left" id="pos-left" />
                  <Label htmlFor="pos-left" className="text-white font-normal">Izquierda</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="right" id="pos-right" />
                  <Label htmlFor="pos-right" className="text-white font-normal">Derecha</Label>
                </div>
              </RadioGroup>
            </div>
          </div>
          
          <div>
            <Label htmlFor="widgetWelcome" className="text-white">Mensaje de Bienvenida</Label>
            <Textarea 
              id="widgetWelcome" 
              value={widgetWelcomeMessage} 
              onChange={(e) => setWidgetWelcomeMessage(e.target.value)} 
              placeholder="Ej: ¡Hola! Soy tu asistente virtual. ¿En qué puedo ayudarte?" 
              className="bg-black/20 border-white/20 text-white mt-2 min-h-[80px]" 
            />
          </div>
        </div>
      </div>

      <div className="pt-6 border-t border-white/10">
        <h3 className="text-xl font-semibold text-white mb-2">Estado del Agente</h3>
        <div className="flex items-center space-x-4 bg-black/20 p-4 rounded-lg">
          <Switch
            id="agent-status"
            checked={status === 'active'}
            onCheckedChange={(checked) => setStatus(checked ? 'active' : 'inactive')}
          />
          <div>
            <Label htmlFor="agent-status" className="text-white font-medium">
              Agente {status === 'active' ? 'Activo' : 'Inactivo'}
            </Label>
            <p className="text-sm text-gray-400">
              Los agentes inactivos no funcionarán en páginas públicas o widgets.
            </p>
          </div>
        </div>
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