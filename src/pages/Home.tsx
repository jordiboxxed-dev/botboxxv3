import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { SkeletonLoader } from '@/components/layout/SkeletonLoader';
import { showError } from '@/utils/toast';

const Home = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const checkUserRoleAndRedirect = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/login');
        return;
      }

      let { data: profile, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      // Si el perfil no existe, lo creamos. Esto es un respaldo para el trigger de la base de datos.
      if (error && error.code === 'PGRST116') {
        console.warn("Perfil no encontrado, creando uno...");

        const firstName = user.user_metadata.first_name || '';
        const lastName = user.user_metadata.last_name || '';
        const fullName = `${firstName} ${lastName}`.trim();

        const { data: newProfile, error: createProfileError } = await supabase
          .from('profiles')
          .insert({
            id: user.id,
            email: user.email,
            first_name: firstName,
            last_name: lastName,
          })
          .select('role')
          .single();
        
        if (createProfileError) {
          showError("No se pudo crear tu perfil. Por favor, intenta de nuevo.");
          console.error("Error al crear perfil principal:", createProfileError);
          await supabase.auth.signOut();
          navigate('/login');
          return;
        }
        
        // Also insert into user_profiles to match the DB trigger
        const { error: createUserProfileError } = await supabase
          .from('user_profiles')
          .insert({ id: user.id, full_name: fullName });

        if (createUserProfileError) {
          console.error("Error al crear perfil de usuario secundario:", createUserProfileError);
          showError("Se creó un perfil parcial. Algunas funciones podrían fallar.");
        }
        
        profile = newProfile;

      } else if (error) {
        showError("No se pudo cargar tu perfil de usuario.");
        console.error("Error al obtener perfil:", error);
        await supabase.auth.signOut();
        navigate('/login');
        return;
      }

      if (!profile) {
        showError("Perfil no encontrado. Por favor, contacta a soporte.");
        await supabase.auth.signOut();
        navigate('/login');
        return;
      }

      switch (profile.role) {
        case 'admin':
          navigate('/admin');
          break;
        case 'agency_owner':
          navigate('/agency');
          break;
        default:
          navigate('/dashboard');
      }
    };

    checkUserRoleAndRedirect();
  }, [navigate]);

  return <SkeletonLoader />;
};

export default Home;