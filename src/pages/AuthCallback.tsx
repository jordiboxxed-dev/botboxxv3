import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";

const AuthCallback = () => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // La librería de Supabase maneja la sesión automáticamente al detectar los parámetros en la URL.
    // Aquí, simplemente decidimos a dónde redirigir al usuario después de eso.
    const params = new URLSearchParams(location.hash.substring(1)); // El hash contiene los tokens
    const type = params.get('type');

    if (type === 'invite') {
      // Si es una invitación, el usuario no tiene contraseña.
      // Lo enviamos a la página de su cuenta para que la establezca.
      navigate('/account?new=true');
    } else {
      // Para otros flujos (login normal, recuperación de contraseña, etc.),
      // lo enviamos a la página de inicio, que se encargará de redirigir.
      navigate("/");
    }
  }, [navigate, location]);

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