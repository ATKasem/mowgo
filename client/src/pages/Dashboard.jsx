import useLocalizedText from '../i18n/useLocalizedText';
import { useState, useEffect, useContext } from 'react';
import { Link } from 'react-router-dom';
import { loadJobs, loadInvoices, loadProfile } from '../lib/data';
import { isDemoMode, supabase } from '../lib/supabase';
import { AuthContext } from '../App';
import { FileText, CheckCircle, Users, DollarSign, Loader2, AlertCircle, X } from 'lucide-react';
import OnboardingChecklist from '../components/OnboardingChecklist';

const CONCIERGE_PROMPT_DISMISS_KEY = 'mf_concierge_prompt_dismissed';
const CONCIERGE_PROMPT_TIERS = ['solo', 'crew', 'premium'];

// Setup-call booking step (activation spec §2). Fires on Dashboard mount —
// not just post-signup — so it also covers the email-confirm login path
// (Login.jsx's confirmSent branch never gets a session for those users) and
// returning logins. Free tier is skipped entirely here; the only place a
// free-tier user sees an upgrade prompt is ConciergeSetup.jsx itself.
function ConciergeBookingPrompt() {
  const { tr } = useLocalizedText('concierge');
  const [profile, setProfile] = useState(null);
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(CONCIERGE_PROMPT_DISMISS_KEY) === '1');
  const [hasClaim, setHasClaim] = useState(null); // null = loading, true/false = result

  useEffect(() => {
    if (isDemoMode()) return;
    let active = true;
    loadProfile().then(result => { if (active) setProfile(result); }).catch(() => {});
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!profile || !profile.id || profile.tier === 'free' || dismissed) return;
    let active = true;
    (async () => {
      const res = await supabase
        .from('concierge_requests')
        .select('id', { count: 'exact' })
        .eq('user_id', profile.id)
        .in('status', ['pending', 'importing', 'done']);
      if (!active) return;
      // RLS policy (014): FOR SELECT USING (auth.uid() = user_id).
      // Postgres enforces RLS before counting — count reflects only rows
      // the current user can see. Zero = no claim, >0 = has an active one.
      setHasClaim(res.count > 0);
    })().catch(() => { if (active) setHasClaim(false); });
    return () => { active = false; };
  }, [profile?.id, profile?.tier, dismissed]);

  if (dismissed || !profile || profile.role === 'crew') return null;
  if (!CONCIERGE_PROMPT_TIERS.includes(profile.tier)) return null;
  // hasClaim: null = still loading (never flash), true = already has a claim,
  // false = confirmed no claim → this is the ONLY state that should show the
  // prompt. (Was inverted: === false hid it exactly when it should appear.)
  if (hasClaim !== false) return null;

  function dismiss() {
    localStorage.setItem(CONCIERGE_PROMPT_DISMISS_KEY, '1');
    setDismissed(true);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 dark:bg-black/70" onClick={dismiss} aria-hidden="true" />
      <div className="relative bg-[var(--color-surface)] dark:bg-gray-900 rounded-2xl shadow-xl max-w-sm w-full p-6 space-y-4">
        <button onClick={dismiss} aria-label={tr('Close')} className="absolute top-3 right-3 text-[var(--color-text-muted)] dark:text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] dark:hover:text-white transition-colors min-w-10 min-h-10 flex items-center justify-center">
          <X className="w-5 h-5" />
        </button>
        <h3 className="text-lg font-bold text-[var(--color-text-primary)] dark:text-white pr-6">
          {tr('Most crews are set up in 48h — your clients imported, first operating week founder-reviewed.')}
        </h3>
        <Link to="/app/settings" onClick={dismiss} className="btn-primary w-full">{tr('Claim it')}</Link>
        <button onClick={dismiss} className="block w-full text-sm text-[var(--color-text-muted)] dark:text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] dark:hover:text-white transition-colors">
          {tr('Maybe later')}
        </button>
      </div>
    </div>
  );
}

// Speed-to-lead catch-all (spec B §3): fires for accounts created in the
// last 7 days — covers the email-confirm path (Login.jsx's signup branch
// never sees a session for those users). Server-side idempotent, so a
// double-fire (direct signup + confirm login) is a harmless no-op.
function LeadTouchPing() {
  const { user } = useContext(AuthContext);
  useEffect(() => {
    if (isDemoMode() || !user?.email) return;
    const created = Date.parse(user.created_at || '');
    if (!Number.isFinite(created) || Date.now() - created > 7 * 24 * 60 * 60 * 1000) return;
    let active = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token;
      if (!token) return;
      const res = await fetch('/api/lead-touch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ email: user.email }),
      });
      if (!res.ok && active) console.warn('lead-touch ping failed', res.status);
    })().catch(() => {});
    return () => { active = false; };
  }, [user?.id, user?.email]);
  return null;
}

// Moment of satisfaction (spec §4C): dismissible banner shown when the user
// has never referred anyone (total_count = 0), has ≥1 invoice, and is on the
// free tier. Duplicates the repo's defensive free-tier literal — data.js:540
// is a local const inside createClient(), not exported, so Dashboard inlines
// the check. total_count (not earned_count) hides it once a referral is in
// flight. Never blocks the dashboard — silent on any fetch failure.
const REFERRAL_BANNER_DISMISS_KEY = 'mf_referral_banner_dismissed';

function ReferralSatisfactionBanner() {
  const { tr } = useLocalizedText('dashboard');
  const [show, setShow] = useState(null); // null = loading, true/false = verdict
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(REFERRAL_BANNER_DISMISS_KEY) === '1'
  );

  useEffect(() => {
    if (dismissed || isDemoMode()) return;
    let active = true;
    (async () => {
      const [profile, invoices, ref] = await Promise.all([
        loadProfile().catch(() => null),
        loadInvoices().catch(() => []),
        supabase.rpc('referral_status').then(r => r.data).catch(() => null),
      ]);
      if (!active) return;
      const freeTier = [undefined, null, '', 'free'].includes(profile?.tier);
      const hasInvoice = (invoices?.length || 0) > 0;
      const neverReferred = !ref || (ref.total_count || 0) === 0;
      setShow(freeTier && hasInvoice && neverReferred);
    })();
    return () => { active = false; };
  }, [dismissed]);

  if (dismissed || show !== true) return null;

  function dismiss() {
    localStorage.setItem(REFERRAL_BANNER_DISMISS_KEY, '1');
    setDismissed(true);
  }

  return (
    <div className="card p-4 mb-5 flex items-center justify-between gap-4 border-brand/30">
      <div>
        <p className="text-sm font-semibold text-[var(--color-text-primary)] dark:text-white">
          {tr('Refer a crew, earn a free month when they subscribe.')}
        </p>
        <Link to="/subscribe" className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline mt-1 inline-block">
          {tr('Get your referral code')}
        </Link>
      </div>
      <button onClick={dismiss} aria-label={tr('Dismiss')} className="min-w-10 min-h-10 flex items-center justify-center text-[var(--color-text-muted)] dark:text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] dark:hover:text-white transition-colors flex-shrink-0">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

/** Get local date string (YYYY-MM-DD) accounting for timezone */
function localDate(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}

export default function Dashboard() {
  const { tr } = useLocalizedText('dashboard');
  const { user } = useContext(AuthContext);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [role, setRole] = useState(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let mounted = true;
    // Reset state on user change to prevent stale data leak
    setLoading(true);
    setError('');
    setStats(null);
    setRole(null);
    async function fetchStats() {
      try {
        const [jobs, invoices, profile] = await Promise.all([
          loadJobs(), loadInvoices(), loadProfile(),
        ]);
        if (!mounted) return;

        // Set role for crew filtering — conservative default: no profile = no revenue
        setRole(profile?.role || 'unknown');

        const today = localDate();
        const weekAgo = localDate(-6); // Mon-Sun = 7 days inclusive

        // Today
        const todayJobs = jobs.filter(j => j.scheduled_date === today);
        const todayDone = todayJobs.filter(j => j.status === 'done');
        const todayRevenue = todayDone.reduce((sum, j) => sum + (j.clients?.rate || 0), 0);

        // Outstanding
        const unpaidTotal = invoices
          .filter(inv => inv.status !== 'paid')
          .reduce((sum, inv) => sum + (inv.amount || 0), 0);

        // This week — count all jobs, not just done
        const weeklyJobs = jobs.filter(j => j.scheduled_date >= weekAgo && j.scheduled_date <= today);
        const weeklyDone = weeklyJobs.filter(j => j.status === 'done');
        const weeklyRevenue = weeklyDone.reduce((sum, j) => sum + (j.clients?.rate || 0), 0);

        // Recurring — count unique CLIENTS with active recurring jobs (future or today)
        const recurringClientIds = new Set(
          jobs.filter(j => j.client_id && j.recurrence && j.recurrence !== 'none' && j.scheduled_date >= today).map(j => j.client_id)
        );

        // Active clients — only those with jobs in the last 30 days (not future)
        const thirtyDaysAgo = localDate(-29);
        const activeClientIds = new Set(
          jobs.filter(j => j.client_id && j.scheduled_date >= thirtyDaysAgo && j.scheduled_date <= today).map(j => j.client_id)
        );

        setStats({
          todayRevenue,
          todayJobsTotal: todayJobs.length,
          todayJobsDone: todayDone.length,
          outstanding: unpaidTotal,
          weeklyRevenue,
          weeklyJobs: weeklyJobs.length,
          weeklyJobsDone: weeklyDone.length,
          activeClients: activeClientIds.size,
          recurringClients: recurringClientIds.size,
        });
      } catch (err) {
        console.error('Dashboard fetchStats:', err);
        if (mounted) setError(err.message || 'Failed to load dashboard');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    fetchStats();
    return () => { mounted = false; };
  }, [user, retryKey]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-brand animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <AlertCircle className="w-8 h-8 text-amber-500" />
        <p className="text-sm text-[var(--color-text-secondary)] dark:text-[var(--color-text-muted)]">{error}</p>
        <button onClick={() => { setError(''); setLoading(true); setRetryKey(k => k + 1); }} className="btn-secondary text-sm">{tr('Retry')}</button>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex items-center justify-center py-20">
        <AlertCircle className="w-8 h-8 text-amber-500" />
      </div>
    );
  }

  // Only confirmed owners see revenue — crew, unknown, and null roles get limited view
  if (role !== 'owner') {
    return (
      <div>
        <h2 className="text-xl font-bold text-[var(--color-text-primary)] dark:text-white mb-5">{tr('Dashboard')}</h2>
        <ConciergeBookingPrompt />
        <LeadTouchPing />
        <OnboardingChecklist />
        <div className="grid grid-cols-2 gap-3">
          <div className="card p-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mb-2.5">
              <CheckCircle className="w-5 h-5 text-brand-hover dark:text-emerald-400" />
            </div>
            <p className="text-2xl font-bold text-[var(--color-text-primary)] dark:text-white">{stats.weeklyJobs}</p>
            <p className="text-sm font-semibold text-[var(--color-text-primary)] dark:text-gray-300 mt-0.5">{tr('Jobs This Week')}</p>
            <p className="text-xs text-[var(--color-text-muted)] dark:text-[var(--color-text-secondary)] mt-0.5">{stats.weeklyJobsDone} {tr('done')}</p>
          </div>
          <div className="card p-4">
            <div className="w-10 h-10 rounded-xl bg-sky-100 dark:bg-sky-900/30 flex items-center justify-center mb-2.5">
              <Users className="w-5 h-5 text-sky-600 dark:text-sky-400" />
            </div>
            <p className="text-2xl font-bold text-[var(--color-text-primary)] dark:text-white">{stats.activeClients}</p>
            <p className="text-sm font-semibold text-[var(--color-text-primary)] dark:text-gray-300 mt-0.5">{tr('Active Clients')}</p>
          </div>
        </div>
      </div>
    );
  }

  const cards = [
    {
      icon: DollarSign,
      iconBg: 'bg-emerald-100 dark:bg-emerald-900/30',
      iconColor: 'text-brand-hover dark:text-emerald-400',
      value: `$${stats.todayRevenue.toLocaleString()}`,
      label: tr('Revenue Today'),
      sub: stats.todayJobsTotal ? `${stats.todayJobsDone}/${stats.todayJobsTotal} ${tr('jobs done')}` : tr('No jobs today'),
    },
    {
      icon: FileText,
      iconBg: 'bg-amber-100 dark:bg-amber-900/30',
      iconColor: 'text-amber-600 dark:text-amber-400',
      value: `$${stats.outstanding.toLocaleString()}`,
      label: tr('Outstanding'),
      sub: tr('Unpaid invoices'),
    },
    {
      icon: CheckCircle,
      iconBg: 'bg-violet-100 dark:bg-violet-900/30',
      iconColor: 'text-violet-600 dark:text-violet-400',
      value: stats.weeklyJobs,
      label: tr('Jobs This Week'),
      sub: `$${stats.weeklyRevenue.toLocaleString()} ${tr('revenue')}`,
    },
    {
      icon: Users,
      iconBg: 'bg-sky-100 dark:bg-sky-900/30',
      iconColor: 'text-sky-600 dark:text-sky-400',
      value: stats.activeClients,
      label: tr('Active Clients'),
      sub: `${stats.recurringClients} ${tr('recurring')}`,
    },
  ];

  return (
    <div>
      <h2 className="text-xl font-bold text-[var(--color-text-primary)] dark:text-white mb-5">{tr('Dashboard')}</h2>
      <ConciergeBookingPrompt />
        <LeadTouchPing />
      <ReferralSatisfactionBanner />
      <OnboardingChecklist />
      <div className="grid grid-cols-2 gap-3">
        {cards.map((card, i) => (
          <div key={i} className="card p-4">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-2.5 ${card.iconBg}`}>
              <card.icon className={`w-5 h-5 ${card.iconColor}`} />
            </div>
            <p className="text-2xl font-bold text-[var(--color-text-primary)] dark:text-white">{card.value}</p>
            <p className="text-sm font-semibold text-[var(--color-text-primary)] dark:text-gray-300 mt-0.5">{card.label}</p>
            <p className="text-xs text-[var(--color-text-muted)] dark:text-[var(--color-text-secondary)] mt-0.5">{card.sub}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
