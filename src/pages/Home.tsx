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

      // If there's an error and it's not "not found", log out the user.
      if (error && error.code !== 'PGRST116') {
        showError("Error al consultar el perfil: " + error.message);
        console.error("Error fetching profile:", error);
        await supabase.auth.signOut();
        navigate('/login');
        return;
      }

      // If profile is null (which includes the "not found" case), create it.
      if (!profile) {
        console.warn("Perfil no encontrado, creando uno...");

        const firstName = user.user_metadata.first_name || '';
        const lastName = user.user_metadata.last_name || '';
        const fullName = `${firstName} ${lastName}`.trim();

        // 1. Create main profile
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
          showError("No se pudo crear tu perfil principal. Por favor, intenta de nuevo.");
          console.error("Error creating main profile:", createProfileError);
          await supabase.auth.signOut();
          navigate('/login');
          return;
        }
        
        // 2. Create secondary user profile
        const { error: createUserProfileError } = await supabase
          .from('user_profiles')
          .insert({ id: user.id, full_name: fullName });

        if (createUserProfileError) {
          showError("No se pudo crear tu perfil secundario. Algunas funciones podrían fallar.");
          console.error("Error creating secondary user profile:", createUserProfileError);
        }
        
        profile = newProfile;
      }

      if (!profile) {
        showError("El perfil no pudo ser creado. Por favor, contacta a soporte.");
        await supabase.auth.signOut();
        navigate('/login');
        return;
      }

      // Redirect based on role
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