import { useState, useEffect } from 'react';

/**
 * Hook to check if an agency owner is currently impersonating a client.
 * This is determined by the presence of 'dyad_impersonation_original_session' in localStorage.
 */
export const useImpersonation = () => {
  const [isImpersonating, setIsImpersonating] = useState(false);

  useEffect(() => {
    const checkStatus = () => {
      const storedSession = localStorage.getItem('dyad_impersonation_original_session');
      setIsImpersonating(!!storedSession);
    };

    checkStatus();

    // Listen for changes in local storage (e.g., from another tab)
    window.addEventListener('storage', checkStatus);

    return () => {
      window.removeEventListener('storage', checkStatus);
    };
  }, []);

  return { isImpersonating };
};