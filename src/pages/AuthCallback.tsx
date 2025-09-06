import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

const AuthCallback = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // La librería de Supabase maneja la sesión automáticamente al detectar los parámetros en la URL.
    // Simplemente redirigimos a la página de login, que a su vez
    // redirigirá al dashboard si la sesión ya está activa.
    // Esto evita condiciones de carrera y simplifica el flujo.
    navigate("/login");
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
        <p className="mt-4">Finalizando autenticación, serás redirigido en un momento...</p>
      </div>
    </div>
  );
};

export default AuthCallback;