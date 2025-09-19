import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { AlertCircle, LogOut } from 'lucide-react';
import { showError } from '@/utils/toast';

export const ImpersonationBanner = () => {
    const [originalSession, setOriginalSession] = useState<any | null>(null);
    const [clientName, setClientName] = useState('');

    useEffect(() => {
        const storedSession = localStorage.getItem('dyad_impersonation_original_session');
        if (storedSession) {
            setOriginalSession(JSON.parse(storedSession));
            
            const fetchClientName = async () => {
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    const { data: profile } = await supabase.from('profiles').select('first_name, last_name').eq('id', user.id).single();
                    if (profile) {
                        setClientName(`${profile.first_name || ''} ${profile.last_name || ''}`.trim());
                    }
                }
            };
            fetchClientName();
        }
    }, []);

    const handleStopImpersonating = async () => {
        if (!originalSession) return;
        try {
            const { access_token, refresh_token } = originalSession;
            const { error } = await supabase.auth.setSession({ access_token, refresh_token });
            if (error) throw error;

            localStorage.removeItem('dyad_impersonation_original_session');
            window.location.href = '/agency';
        } catch (error) {
            showError("No se pudo volver a tu cuenta: " + (error as Error).message);
        }
    };

    if (!originalSession) {
        return null;
    }

    return (
        <div className="fixed bottom-4 right-4 bg-purple-600 text-white p-4 rounded-lg shadow-lg z-50 flex items-center gap-4">
            <AlertCircle className="w-6 h-6" />
            <div>
                <p className="font-bold">Estás viendo como {clientName || 'un cliente'}</p>
                <p className="text-sm">Todas las acciones se realizarán en su nombre.</p>
            </div>
            <Button variant="secondary" size="sm" onClick={handleStopImpersonating}>
                <LogOut className="w-4 h-4 mr-2" />
                Volver a mi cuenta
            </Button>
        </div>
    );
};