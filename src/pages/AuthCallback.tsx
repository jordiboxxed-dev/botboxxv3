import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { showError } from "@/utils/toast";

const AuthCallback = () => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // Deja que Supabase maneje automáticamente los parámetros de la URL
        const { data, error } = await supabase.auth.getSession();
        
        if (error) throw error;
        
        if (data.session) {
          // Usuario autenticado correctamente
          navigate('/dashboard');
        } else {
          // No hay sesión, redirigir a login
          navigate('/login');
        }
      } catch (error) {
        console.error('Error en callback de autenticación:', error);
        showError('Error al procesar la autenticación');
        navigate('/login');
      }
    };

    handleAuthCallback();
  }, [navigate, location]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
        <p className="mt-4">Procesando autenticación...</p>
      </div>
    </div>
  );
};

export default AuthCallback;