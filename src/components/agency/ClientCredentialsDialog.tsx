import { useState } from "react";
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
import { Label } from "@/components/ui/label";
import { showSuccess } from "@/utils/toast";
import { Check, Copy, AlertTriangle } from "lucide-react";

interface ClientCredentialsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  credentials: { email: string; password: string } | null;
}

export const ClientCredentialsDialog = ({ open, onOpenChange, credentials }: ClientCredentialsDialogProps) => {
  const [hasCopied, setHasCopied] = useState(false);

  if (!credentials) return null;

  const handleCopy = () => {
    const textToCopy = `Email: ${credentials.email}\nContraseña: ${credentials.password}`;
    navigator.clipboard.writeText(textToCopy);
    setHasCopied(true);
    showSuccess("¡Credenciales copiadas!");
    setTimeout(() => setHasCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-gray-900/80 backdrop-blur-lg border-white/10 text-white">
        <DialogHeader>
          <DialogTitle>Cliente Creado Exitosamente</DialogTitle>
          <DialogDescription>
            Comparte estas credenciales de forma segura con tu cliente.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <div>
            <Label htmlFor="client-email">Email</Label>
            <Input id="client-email" value={credentials.email} readOnly />
          </div>
          <div>
            <Label htmlFor="client-password">Contraseña Temporal</Label>
            <Input id="client-password" value={credentials.password} readOnly />
          </div>
          <div className="bg-yellow-900/50 border border-yellow-500/30 text-yellow-200 text-sm rounded-md p-3 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-semibold">¡Importante!</p>
              <p>Esta es la única vez que se mostrará esta contraseña. Cópiala y guárdala en un lugar seguro antes de cerrar esta ventana.</p>
            </div>
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="secondary" onClick={handleCopy}>
            {hasCopied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
            Copiar Credenciales
          </Button>
          <Button onClick={() => onOpenChange(false)}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};