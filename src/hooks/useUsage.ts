import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { differenceInDays } from 'date-fns';

export interface UsageInfo {
  plan: string;
  trialDaysLeft: number | null;
  messagesSent: number;
  messageLimit: number;
  agentsCreated: number;
  agentLimit: number;
  isTrialActive: boolean;
  hasReachedMessageLimit: boolean;
  hasReachedAgentLimit: boolean;
}

export const useUsage = () => {
  const [usageInfo, setUsageInfo] = useState<UsageInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUsage = useCallback(async () => {
    setIsLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setIsLoading(false);
      return;
    }

    const currentMonthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

    const [profileRes, usageRes, agentsRes] = await Promise.all([
      supabase.from('profiles').select('plan, trial_ends_at').eq('id', user.id).single(),
      supabase.from('usage_stats').select('messages_sent').eq('user_id', user.id).eq('month_start', currentMonthStart).single(),
      supabase.from('agents').select('id', { count: 'exact', head: true }).eq('user_id', user.id).is('deleted_at', null)
    ]);

    const profile = profileRes.data;
    const usage = usageRes.data;
    const agentCount = agentsRes.count || 0;

    if (profile) {
      const plan = profile.plan || 'trial';
      const trialEndsAt = profile.trial_ends_at ? new Date(profile.trial_ends_at) : null;
      const trialDaysLeft = trialEndsAt ? Math.max(0, differenceInDays(trialEndsAt, new Date())) : null;
      const isTrialActive = plan === 'trial' && trialDaysLeft !== null && trialDaysLeft > 0;

      const messageLimit = plan === 'trial' ? 150 : Infinity;
      const agentLimit = plan === 'trial' ? 2 : Infinity;
      const messagesSent = usage?.messages_sent || 0;

      setUsageInfo({
        plan,
        trialDaysLeft,
        messagesSent,
        messageLimit,
        agentsCreated: agentCount,
        agentLimit,
        isTrialActive,
        hasReachedMessageLimit: messagesSent >= messageLimit,
        hasReachedAgentLimit: agentCount >= agentLimit,
      });
    }

    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchUsage();
  }, [fetchUsage]);

  return { usageInfo, isLoading, refreshUsage: fetchUsage };
};