import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { showError, showSuccess } from "@/utils/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, ArrowLeft, Info } from "lucide-react";

interface Profile {
  first_name: string;
  last_name: string;
  email: string;
}

const Account = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [updatingProfile, setUpdatingProfile] = useState(false);
  const [updatingPassword, setUpdatingPassword] = useState(false);
  
  const [profile, setProfile] = useState<Profile | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const isNewUser = new URLSearchParams(location.search).get('new') === 'true';

  useEffect(() => {
    const fetchProfile = async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data, error } = await supabase
          .from('profiles')
          .select('first_name, last_name')
          .eq('id', user.id)
          .single();

        if (error) {
          showError("No se pudo cargar tu perfil.");
          console.error(error);
        } else if (data) {
          setProfile({ ...data, email: user.email || '' });
          setFirstName(data.first_name || "");
          setLastName(data.last_name || "");
        }
      }
      setLoading(false);
    };
    fetchProfile();
  }, []);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpdatingProfile(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { error } = await supabase
        .from('profiles')
        .update({ first_name: firstName, last_name: lastName })
        .eq('id', user.id);
      
      if (error) {
        showError("Error al actualizar el perfil: " + error.message);
      } else {
        showSuccess("Perfil actualizado correctamente.");
      }
    }
    setUpdatingProfile(false);
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      showError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      showError("Las contraseñas no coinciden.");
      return;
    }
    setUpdatingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      showError("Error al cambiar la contraseña: " + error.message);
    } else {
      showSuccess("Contraseña establecida con éxito.");
      setNewPassword("");
      setConfirmPassword("");
      if (isNewUser) {
        navigate('/dashboard'); // Redirect after setting password for the first time
      }
    }
    setUpdatingPassword(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 p-4">
        <div className="w-full max-w-2xl space-y-6">
          <Skeleton className="h-10 w-1/3" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          {!isNewUser && (
            <Button variant="ghost" onClick={() => navigate('/dashboard')} className="mb-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Volver al Dashboard
            </Button>
          )}
          <h1 className="text-3xl font-bold">Mi Cuenta</h1>
          <p className="text-gray-400">Gestiona tu información personal y seguridad.</p>
        </div>

        {isNewUser && (
          <Alert className="mb-6 bg-blue-900/50 border-blue-500/30 text-blue-200">
            <Info className="h-4 w-4 !text-blue-300" />
            <AlertTitle className="text-white font-bold">¡Bienvenido/a!</AlertTitle>
            <AlertDescription>
              Para completar la configuración de tu cuenta, por favor establece una contraseña segura.
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-8">
          <Card className="bg-black/30 border-white/10">
            <CardHeader>
              <CardTitle className="text-white">Información del Perfil</CardTitle>
              <CardDescription className="text-gray-400">Actualiza tu nombre y apellido.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleUpdateProfile} className="space-y-4">
                <div>
                  <Label htmlFor="email" className="text-white">Email</Label>
                  <Input id="email" type="email" value={profile?.email || ''} disabled className="bg-black/40 border-white/20 mt-1 text-gray-400" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="firstName" className="text-white">Nombre</Label>
                    <Input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} className="bg-black/20 border-white/20 text-white mt-1" />
                  </div>
                  <div>
                    <Label htmlFor="lastName" className="text-white">Apellido</Label>
                    <Input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} className="bg-black/20 border-white/20 text-white mt-1" />
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button type="submit" disabled={updatingProfile}>
                    {updatingProfile ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Guardando...</> : "Guardar Cambios"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card className="bg-black/30 border-white/10">
            <CardHeader>
              <CardTitle className="text-white">{isNewUser ? "Establecer Contraseña" : "Cambiar Contraseña"}</CardTitle>
              <CardDescription className="text-gray-400">Elige una contraseña nueva y segura.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleUpdatePassword} className="space-y-4">
                <div>
                  <Label htmlFor="newPassword" className="text-white">Nueva Contraseña</Label>
                  <Input id="newPassword" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="bg-black/20 border-white/20 text-white mt-1" />
                </div>
                <div>
                  <Label htmlFor="confirmPassword" className="text-white">Confirmar Nueva Contraseña</Label>
                  <Input id="confirmPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="bg-black/20 border-white/20 text-white mt-1" />
                </div>
                <div className="flex justify-end">
                  <Button type="submit" disabled={updatingPassword}>
                    {updatingPassword ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Guardando...</> : isNewUser ? "Guardar y Continuar" : "Cambiar Contraseña"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Account;