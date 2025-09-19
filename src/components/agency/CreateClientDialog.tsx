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
import { Loader2 } from "lucide-react";
import { ClientCredentialsDialog } from "./ClientCredentialsDialog";

interface CreateClientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClientCreated: () => void;
}

interface ClientCredentials {
  email: string;
  password: string;
}

export const CreateClientDialog = ({ open, onOpenChange, onClientCreated }: CreateClientDialogProps) => {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  
  const [newClientCredentials, setNewClientCredentials] = useState<ClientCredentials | null>(null);
  const [isCredentialsDialogOpen, setIsCredentialsDialogOpen] = useState(false);

  const resetForm = () => {
    setFirstName("");
    setLastName("");
    setEmail("");
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
      resetForm();
      onClientCreated();
      onOpenChange(false);

      if (data.credentials) {
        setNewClientCredentials(data.credentials);
        setIsCredentialsDialogOpen(true);
      }

    } catch (error) {
      showError("Error al crear el cliente: " + (error as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="bg-gray-900/80 backdrop-blur-lg border-white/10 text-white">
          <DialogHeader>
            <DialogTitle>Crear Nuevo Cliente</DialogTitle>
            <DialogDescription>
              Se creará una cuenta para tu cliente con una contraseña temporal. Deberás compartir estas credenciales de forma segura.
            </DialogDescription>
          </DialogHeader>
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
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>Cancelar</Button>
            <Button onClick={handleCreateClient} disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Crear Cliente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ClientCredentialsDialog
        open={isCredentialsDialogOpen}
        onOpenChange={setIsCredentialsDialogOpen}
        credentials={newClientCredentials}
      />
    </>
  );
};