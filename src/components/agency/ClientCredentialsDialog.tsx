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
import { Check, Copy, AlertTriangle } from "lucide-react";

interface ClientCredentialsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  credentials: { email: string; tempPassword: string } | null;
}

export const ClientCredentialsDialog = ({ open, onOpenChange, credentials }: ClientCredentialsDialogProps) => {
  const [hasCopied, setHasCopied] = useState(false);

  if (!credentials) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(credentials.tempPassword);
    setHasCopied(true);
    setTimeout(() => setHasCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-gray-900/80 backdrop-blur-lg border-white/10 text-white">
        <DialogHeader>
          <DialogTitle>Cliente Creado Exitosamente</DialogTitle>
          <DialogDescription>
            La cuenta para {credentials.email} ha sido creada.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <div className="bg-yellow-900/50 border border-yellow-500/30 text-yellow-200 p-4 rounded-lg flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 mt-1 flex-shrink-0" />
            <div>
              <h4 className="font-bold">¡Importante!</h4>
              <p className="text-sm">
                Comparte estas credenciales de forma segura con tu cliente. Esta es la <strong>única vez</strong> que se mostrará esta contraseña temporal.
              </p>
            </div>
          </div>
          <div>
            <Label htmlFor="client-email">Email del Cliente</Label>
            <Input id="client-email" value={credentials.email} readOnly />
          </div>
          <div>
            <Label htmlFor="client-password">Contraseña Temporal</Label>
            <div className="relative">
              <Input id="client-password" value={credentials.tempPassword} readOnly />
              <Button
                size="icon"
                variant="ghost"
                className="absolute top-1/2 right-2 -translate-y-1/2 h-7 w-7"
                onClick={handleCopy}
                type="button"
              >
                {hasCopied ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          <p className="text-sm text-gray-400">
            El cliente deberá usar estas credenciales para iniciar sesión y se le pedirá que cambie su contraseña inmediatamente.
          </p>
        </div>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Entendido</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};