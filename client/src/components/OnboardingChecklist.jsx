import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Circle, X } from 'lucide-react';
import useLocalizedText from '../i18n/useLocalizedText';
import { supabase, isDemoMode } from '../lib/supabase';

const DISMISS_KEY = 'mf_onboarding_dismissed';
const CONCIERGE_TIERS = ['solo', 'crew', 'premium'];

async function fetchActivationProfile() {
  if (isDemoMode()) return null;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, tier, first_client_at, first_job_at, first_invoice_at')
    .eq('id', user.id)
    .single();

  if (!profile || profile.role === 'crew') return null;
  // Onboarding is the OWNER's job — never show this to crew members.
  return profile;
}

export default function OnboardingChecklist({ showConcierge = true }) {
  const { tr } = useLocalizedText('onboarding');
  const [profile, setProfile] = useState(null);
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISS_KEY) === '1');

  useEffect(() => {
    let active = true;
    fetchActivationProfile().then(result => { if (active) setProfile(result); }).catch(() => {});
    const timer = setTimeout(() => {
      fetchActivationProfile().then(result => { if (active) setProfile(result); }).catch(() => {});
    }, 5000);
    return () => { active = false; clearTimeout(timer); };
  }, []);

  if (dismissed || !profile) return null;

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, '1');
    setDismissed(true);
  }

  const allDone = Boolean(profile.first_client_at && profile.first_job_at && profile.first_invoice_at);
  const conciergeEligible = showConcierge && CONCIERGE_TIERS.includes(profile.tier);

  // Fully activated (ever activated — timestamps are set once and never
  // cleared, so this doesn't re-nag after a client/job/invoice is deleted):
  // drop the step list. Eligible tiers get a one-line concierge nudge
  // instead of vanishing outright; free tier gets nothing further — no
  // forced upsell, concierge access stays gated in ConciergeSetup.jsx.
  if (allDone) {
    if (!conciergeEligible) return null;
    return (
      <div className="card rounded-2xl p-4 mb-4 border-brand/30">
        <div className="flex items-start justify-between gap-3">
          <Link to="/app/settings" className="text-sm font-medium text-[var(--color-text-primary)] dark:text-gray-200 no-underline hover:underline">
            {tr("You're rolling. Want a review call?")}
          </Link>
          <button onClick={dismiss} aria-label={tr('Maybe later')} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] dark:hover:text-white flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  const rows = [
    { label: tr('Add your first client'), to: '/app/clients', done: Boolean(profile.first_client_at) },
    { label: tr('Schedule your first job'), to: '/app/today', done: Boolean(profile.first_job_at) },
    { label: tr('Mark a job complete'), to: '/app/today', done: Boolean(profile.first_invoice_at) },
  ];
  if (conciergeEligible) {
    rows.push({ label: tr('Get set up for you — free concierge'), to: '/app/settings', done: false });
  }

  return (
    <div className="card rounded-2xl p-4 mb-4 border-brand/30">
      <div className="flex items-start justify-between gap-3 mb-3">
        <h3 className="font-bold text-[var(--color-text-primary)] dark:text-white">{tr('Start in 3 steps')}</h3>
        <button onClick={dismiss} aria-label={tr('Maybe later')} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] dark:hover:text-white">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="space-y-2">
        {rows.map((row, i) => (
          <Link key={i} to={row.to} className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 -mx-2.5 hover:bg-[var(--color-surface-secondary)] dark:hover:bg-gray-800 transition-colors no-underline">
            {row.done ? <CheckCircle2 className="w-5 h-5 text-brand flex-shrink-0" /> : <Circle className="w-5 h-5 text-[var(--color-text-muted)] flex-shrink-0" />}
            <span className={`text-sm ${row.done ? 'text-[var(--color-text-muted)] line-through' : 'text-[var(--color-text-primary)] dark:text-gray-200 font-medium'}`}>{row.label}</span>
          </Link>
        ))}
      </div>
      <button onClick={dismiss} className="mt-3 text-xs font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] dark:hover:text-white">
        {tr('Maybe later')}
      </button>
    </div>
  );
}
