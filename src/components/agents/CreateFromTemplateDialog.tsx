import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Agent as TemplateAgent } from "@/data/mock-agents";
import { Loader2 } from "lucide-react";

interface CreateFromTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: TemplateAgent | null;
  onSubmit: (name: string, companyName: string) => void;
  isSubmitting: boolean;
}

export const CreateFromTemplateDialog = ({ open, onOpenChange, template, onSubmit, isSubmitting }: CreateFromTemplateDialogProps) => {
  const [name, setName] = useState("");
  const [companyName, setCompanyName] = useState("");

  useEffect(() => {
    if (template) {
      setName(template.name);
      setCompanyName(""); // Reset company name for new template
    }
  }, [template]);

  const handleSubmit = () => {
    onSubmit(name, companyName);
  };

  if (!template) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-gray-900/80 backdrop-blur-lg border-white/10 text-white">
        <DialogHeader>
          <DialogTitle>Crear agente desde "{template.name}"</DialogTitle>
          <DialogDescription>
            Personaliza los detalles básicos de tu nuevo agente.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <div>
            <Label htmlFor="agent-name">Nombre del Agente</Label>
            <Input id="agent-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="company-name">Nombre de la Empresa (Opcional)</Label>
            <Input id="company-name" value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || !name}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Crear Agente
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};