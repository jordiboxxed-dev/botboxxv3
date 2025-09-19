import { supabase } from "@/integrations/supabase/client";
import { showError } from "./toast";

export const handleEmailConfirmation = async (searchParams: URLSearchParams) => {
  const accessToken = searchParams.get('access_token');
  const refreshToken = searchParams.get('refresh_token');
  const type = searchParams.get('type');

  if (accessToken && refreshToken && type === 'signup') {
    try {
      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error al confirmar email:', error);
      showError('Error al confirmar el correo electrónico.');
      return false;
    }
  }
  return false;
};