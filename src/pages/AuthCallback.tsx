import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const AuthCallback = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Este listener se activa específicamente cuando Supabase detecta un evento de inicio de sesión,
    // como el que ocurre al hacer clic en el enlace de confirmación de correo.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        // Una vez que se confirma el inicio de sesión, redirigimos al dashboard.
        navigate('/dashboard');
      }
    });

    // Es importante limpiar la suscripción cuando el componente se desmonta.
    return () => {
      subscription.unsubscribe();
    };
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
        <p className="mt-4">Procesando autenticación, por favor espera...</p>
      </div>
    </div>
  );
};

export default AuthCallback;