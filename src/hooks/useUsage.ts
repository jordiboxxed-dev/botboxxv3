import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { differenceInDays } from 'date-fns';

export interface UsageInfo {
  plan: string;
  role: string;
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

    let { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('plan, trial_ends_at, role')
      .eq('id', user.id)
      .single();

    if (profileError && profileError.code !== 'PGRST116') {
      console.error("Failed to fetch profile in useUsage:", profileError);
      profile = null;
    }

    if (!profile) {
      console.warn("User profile not found in useUsage, attempting to create one...");

      const firstName = user.user_metadata.first_name || '';
      const lastName = user.user_metadata.last_name || '';
      const fullName = `${firstName} ${lastName}`.trim();

      const { data: newProfile, error: createError } = await supabase
        .from('profiles')
        .insert({
          id: user.id,
          email: user.email,
          first_name: user.user_metadata.first_name || '',
          last_name: user.user_metadata.last_name || '',
        })
        .select('plan, trial_ends_at, role')
        .single();
      
      if (createError) {
        console.error("Failed to create profile from useUsage:", createError);
        profile = null;
      } else {
        profile = newProfile;
        const { error: createUserProfileError } = await supabase
          .from('user_profiles')
          .insert({ id: user.id, full_name: fullName });
        if (createUserProfileError) {
          console.error("Failed to create secondary user profile from useUsage:", createUserProfileError);
        }
      }
    }

    const currentMonthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

    const [usageRes, agentsRes] = await Promise.all([
      supabase.from('usage_stats').select('messages_sent').eq('user_id', user.id).eq('month_start', currentMonthStart).single(),
      supabase.from('agents').select('id', { count: 'exact', head: true }).eq('user_id', user.id).is('deleted_at', null)
    ]);

    const usage = usageRes.data;
    const agentCount = agentsRes.count || 0;

    if (profile) {
      const plan = profile.plan || 'trial';
      const role = profile.role || 'user';
      const trialEndsAt = profile.trial_ends_at ? new Date(profile.trial_ends_at) : null;
      const trialDaysLeft = trialEndsAt ? Math.max(0, differenceInDays(trialEndsAt, new Date())) : null;
      const isTrialActive = plan === 'trial' && trialDaysLeft !== null && trialDaysLeft > 0;

      const getMessageLimit = () => {
        switch (plan) {
          case 'trial': return 150;
          case 'pro': return 1000;
          case 'premium': return 10000;
          default: return Infinity;
        }
      };

      const getAgentLimit = () => {
        switch (plan) {
          case 'trial': return 1;
          case 'pro': return 5;
          default: return Infinity;
        }
      };

      const messageLimit = getMessageLimit();
      const agentLimit = getAgentLimit();
      const messagesSent = usage?.messages_sent || 0;

      setUsageInfo({
        plan,
        role,
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