import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase, isDemoMode } from '../lib/supabase';
import { useAuth } from '../App';
import useLocalizedText from '../i18n/useLocalizedText';

/**
 * Banner shown to users on an active or expired app trial.
 * - Active trial: countdown "X days left in your {Plan} trial" + Subscribe CTA.
 * - Expired trial (tier reverted): "Your trial ended" + Subscribe CTA.
 * - Real paid tier or free-without-trial: renders nothing.
 * Calls expire_trial() on mount (idempotent) so the UI converges.
 */
export default function TrialBanner() {
  const { tr } = useLocalizedText('trialBanner');
  const { user } = useAuth();
  const [trialInfo, setTrialInfo] = useState(null); // { trialTier, trialEndsAt, tier } | null

  useEffect(() => {
    if (isDemoMode() || !user) return;
    let active = true;

    (async () => {
      // Expire any past trial first (idempotent, converges UI state).
      try { await supabase.rpc('expire_trial'); } catch { /* non-fatal */ }

      if (!active) return;
      const { data, error } = await supabase
        .from('profiles')
        .select('trial_tier, trial_ends_at, tier')
        .eq('id', user.id)
        .single();
      if (!active || error || !data) return;
      setTrialInfo({
        trialTier: data.trial_tier,
        trialEndsAt: data.trial_ends_at,
        tier: data.tier,
      });
    })();

    return () => { active = false; };
  }, [user]);

  if (!trialInfo) return null;

  const { trialTier, trialEndsAt, tier } = trialInfo;
  const now = Date.now();
  const endsAt = trialEndsAt ? new Date(trialEndsAt).getTime() : 0;
  const isActive = trialTier && endsAt > now;
  const isExpired = trialTier && endsAt && endsAt <= now && tier === 'free';
  const isRealPaid = tier && tier !== 'free' && !trialTier;

  // Real paid subscriber (no trial row) or plain free user: hide.
  if (isRealPaid || (!trialTier && tier === 'free')) return null;

  const planLabel = trialTier
    ? (trialTier === 'crew' ? 'Crew' : trialTier === 'premium' ? 'Premium' : 'Solo')
    : (tier === 'crew' ? 'Crew' : tier === 'premium' ? 'Premium' : 'Solo');

  if (isActive) {
    const daysLeft = Math.ceil((endsAt - now) / 86400000);
    return (
      <div className="bg-emerald-50 dark:bg-emerald-950/30 border-b border-emerald-200 dark:border-emerald-800/40">
        <div className="max-w-2xl mx-auto px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">
              {tr('{{days}} days left in your {{plan}} trial', { days: daysLeft, plan: planLabel })}
            </p>
            <p className="text-xs text-emerald-600 dark:text-emerald-400">
              {tr('Subscribe to keep unlimited clients & jobs')}
            </p>
          </div>
          <Link
            to="/subscribe"
            className="inline-flex items-center justify-center min-h-[44px] px-5 rounded-lg bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-400 text-white text-sm font-semibold transition-colors"
          >
            {tr('Subscribe')}
          </Link>
        </div>
      </div>
    );
  }

  if (isExpired) {
    return (
      <div className="bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-800/40">
        <div className="max-w-2xl mx-auto px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">
              {tr('Your trial ended')}
            </p>
            <p className="text-xs text-amber-600 dark:text-amber-400">
              {tr('Your clients are safe — subscribe to keep scheduling beyond 5.')}
            </p>
          </div>
          <Link
            to="/subscribe"
            className="inline-flex items-center justify-center min-h-[44px] px-5 rounded-lg bg-amber-600 hover:bg-amber-700 dark:bg-amber-500 dark:hover:bg-amber-400 text-white text-sm font-semibold transition-colors"
          >
            {tr('Subscribe')}
          </Link>
        </div>
      </div>
    );
  }

  return null;
}
