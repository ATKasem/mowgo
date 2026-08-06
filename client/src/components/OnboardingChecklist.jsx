import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Circle, X } from 'lucide-react';
import useLocalizedText from '../i18n/useLocalizedText';
import { supabase, isDemoMode } from '../lib/supabase';

const DISMISS_KEY = 'mf_onboarding_dismissed';

async function fetchActivationCounts() {
  if (isDemoMode()) return null;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, business_id, tier')
    .eq('id', user.id)
    .single();

  if (!profile || profile.role === 'crew') return null;
  // Onboarding is the OWNER's job — never show this to crew members.
  const ownerId = user.id;

  const [clientResult, jobResult, doneJobResult] = await Promise.all([
    supabase.from('clients').select('id', { count: 'exact', head: true }).eq('user_id', ownerId),
    supabase.from('jobs').select('id', { count: 'exact', head: true }).eq('user_id', ownerId),
    supabase.from('jobs').select('id', { count: 'exact', head: true }).eq('user_id', ownerId).eq('status', 'done'),
  ]);

  return {
    clients: clientResult.count || 0,
    jobs: jobResult.count || 0,
    doneJobs: doneJobResult.count || 0,
    tier: profile?.tier,
  };
}

export default function OnboardingChecklist() {
  const { tr } = useLocalizedText('onboarding');
  const [counts, setCounts] = useState(null);
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISS_KEY) === '1');

  useEffect(() => {
    let active = true;
    fetchActivationCounts().then(result => { if (active) setCounts(result); }).catch(() => {});
    const timer = setTimeout(() => {
      fetchActivationCounts().then(result => { if (active) setCounts(result); }).catch(() => {});
    }, 5000);
    return () => { active = false; clearTimeout(timer); };
  }, []);

  if (dismissed || !counts) return null;
  // Fully activated (client added and a job scheduled) — nudge is no longer useful.
  if (counts.clients > 0 && counts.jobs > 0) return null;

  const rows = [
    { label: tr('Add your first client'), to: '/app/clients', done: counts.clients > 0 },
    { label: tr('Schedule your first job'), to: '/app/today', done: counts.jobs > 0 },
    { label: tr('Mark a job complete'), to: '/app/today', done: counts.doneJobs > 0 },
  ];
  if (['solo', 'crew', 'premium'].includes(counts.tier)) {
    rows.push({ label: tr('Get set up for you — free concierge'), to: '/app/settings', done: false });
  }

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, '1');
    setDismissed(true);
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
