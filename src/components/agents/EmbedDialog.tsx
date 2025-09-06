import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Check, Copy } from "lucide-react";
import { showSuccess } from "@/utils/toast";

interface EmbedDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentId: string;
}

export const EmbedDialog = ({ open, onOpenChange, agentId }: EmbedDialogProps) => {
  const [hasCopied, setHasCopied] = useState(false);

  const embedUrl = `${window.location.origin}/embed/agent/${agentId}`;
  const iframeCode = `<iframe src="${embedUrl}" width="100%" height="100%" frameborder="0"></iframe>`;

  const handleCopy = () => {
    navigator.clipboard.writeText(iframeCode);
    setHasCopied(true);
    showSuccess("¡Código copiado al portapapeles!");
    setTimeout(() => setHasCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Incrustar Agente</DialogTitle>
          <DialogDescription>
            Copia y pega este código en tu sitio web para añadir el chat.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
          <div className="space-y-4">
            <div>
              <Label htmlFor="iframe-code">Código de Inserción</Label>
              <div className="relative mt-2">
                <pre className="bg-gray-800 text-white p-4 rounded-md text-xs overflow-x-auto">
                  <code>{iframeCode}</code>
                </pre>
                <Button
                  size="icon"
                  variant="ghost"
                  className="absolute top-2 right-2 h-7 w-7"
                  onClick={handleCopy}
                >
                  {hasCopied ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <p className="text-sm text-gray-400">
              Este `iframe` cargará tu agente de chat de forma segura dentro de tu página web. Puedes ajustar los atributos `width` y `height` según tus necesidades.
            </p>
          </div>
          <div>
            <Label>Vista Previa en Vivo</Label>
            <div className="mt-2 w-full h-[450px] border border-gray-700 rounded-md overflow-hidden relative bg-gray-900">
              <iframe
                src={embedUrl}
                title="Vista previa del agente"
                width="100%"
                height="100%"
                frameBorder="0"
              />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};