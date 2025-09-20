import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
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
import { showError, showSuccess } from "@/utils/toast";
import { Loader2, Check, Copy } from "lucide-react";

interface CreateClientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClientCreated: () => void;
}

export const CreateClientDialog = ({ open, onOpenChange, onClientCreated }: CreateClientDialogProps) => {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [createdClientInfo, setCreatedClientInfo] = useState<{ email: string; temporaryPassword: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const resetForm = () => {
    setFirstName("");
    setLastName("");
    setEmail("");
    setCreatedClientInfo(null);
    setCopied(false);
  };

  const handleClose = () => {
    onOpenChange(false);
    // Delay reset to allow for closing animation
    setTimeout(resetForm, 300);
  };

  const handleCopyPassword = () => {
    if (createdClientInfo) {
      navigator.clipboard.writeText(createdClientInfo.temporaryPassword);
      setCopied(true);
      showSuccess("Contraseña copiada al portapapeles.");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCreateClient = async () => {
    if (!firstName || !lastName || !email) {
      showError("Todos los campos son obligatorios.");
      return;
    }
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-agency-client', {
        body: { firstName, lastName, email }
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      showSuccess(data.message);
      setCreatedClientInfo({ email, temporaryPassword: data.temporaryPassword });
      onClientCreated();

    } catch (error) {
      showError("Error al crear el cliente: " + (error as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-gray-900/80 backdrop-blur-lg border-white/10 text-white">
        <DialogHeader>
          <DialogTitle>{createdClientInfo ? "Cliente Creado Exitosamente" : "Crear Nuevo Cliente"}</DialogTitle>
          <DialogDescription>
            {createdClientInfo 
              ? "Guarda esta contraseña temporal. El cliente deberá cambiarla en su primer inicio de sesión."
              : "Se creará una cuenta para tu cliente con una contraseña temporal."
            }
          </DialogDescription>
        </DialogHeader>
        
        {createdClientInfo ? (
          <div className="py-4 space-y-4">
            <div>
              <Label>Email del Cliente</Label>
              <p className="font-mono text-sm p-2 bg-black/20 rounded-md">{createdClientInfo.email}</p>
            </div>
            <div>
              <Label>Contraseña Temporal</Label>
              <div className="flex items-center gap-2">
                <p className="flex-1 font-mono text-sm p-2 bg-black/20 rounded-md">{createdClientInfo.temporaryPassword}</p>
                <Button size="icon" variant="outline" onClick={handleCopyPassword}>
                  {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="py-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="firstName">Nombre</Label>
                <Input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="lastName">Apellido</Label>
                <Input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} />
              </div>
            </div>
            <div>
              <Label htmlFor="email">Email del Cliente</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
          </div>
        )}

        <DialogFooter>
          {createdClientInfo ? (
            <Button onClick={handleClose}>Cerrar</Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>Cancelar</Button>
              <Button onClick={handleCreateClient} disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Crear Cliente
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};