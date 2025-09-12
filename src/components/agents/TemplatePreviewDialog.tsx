import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Agent } from "@/data/mock-agents";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bot, FileText } from "lucide-react";

interface TemplatePreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agent: Agent | null;
  onUseTemplate: () => void;
  isCreationDisabled?: boolean;
}

export const TemplatePreviewDialog = ({ open, onOpenChange, agent, onUseTemplate, isCreationDisabled = false }: TemplatePreviewDialogProps) => {
  if (!agent) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl bg-gray-900/80 backdrop-blur-lg border-white/10 text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-2xl">
            <div className="p-2 bg-white/10 rounded-md">
              <Bot className="w-6 h-6 text-gray-300" />
            </div>
            Vista Previa: {agent.name}
          </DialogTitle>
          <DialogDescription className="text-gray-400 pt-2">
            {agent.description}
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4 max-h-[60vh] overflow-y-auto pr-4">
          <Card className="bg-black/30 border-white/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg text-gray-200">
                <FileText className="w-5 h-5" />
                Instrucciones Base / Personalidad (System Prompt)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="bg-black/40 p-4 rounded-md text-sm text-gray-300 whitespace-pre-wrap font-sans">
                {agent.systemPrompt}
              </pre>
            </CardContent>
          </Card>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cerrar</Button>
          <Button 
            onClick={onUseTemplate}
            disabled={isCreationDisabled}
            title={isCreationDisabled ? "Has alcanzado el límite de agentes de tu plan" : ""}
          >
            Usar esta Plantilla
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};