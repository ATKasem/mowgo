import useLocalizedText from '../i18n/useLocalizedText';
import { useState, useEffect, useContext } from 'react';
import { Link } from 'react-router-dom';
import { loadJobs, loadInvoices, loadProfile, loadTeamDashboard } from '../lib/data';
import { isDemoMode, supabase } from '../lib/supabase';
import { AuthContext } from '../App';
import { FileText, CheckCircle, Users, DollarSign, Loader2, AlertCircle, X, CalendarDays } from 'lucide-react';
import OnboardingChecklist from '../components/OnboardingChecklist';
import ConciergeStatus from '../components/ConciergeStatus';
import { localDate, summarizeDashboard } from '../lib/dashboard-metrics';
import { hasTeamAccess } from '../lib/constants';
import { teamProgressView } from '../lib/today-ux';
import { conciergeRequestRpcState, dashboardConciergeView, isActiveOrDoneConciergeRequest } from '../lib/concierge-request';

const CONCIERGE_PROMPT_DISMISS_KEY = 'mf_concierge_prompt_dismissed';
const CONCIERGE_PROMPT_TIERS = ['solo', 'crew', 'premium'];

// Setup-call booking step (activation spec §2). Fires on Dashboard mount —
// not just post-signup — so it also covers the email-confirm login path
// (Login.jsx's confirmSent branch never gets a session for those users) and
// returning logins. Free tier is skipped entirely here; the only place a
// free-tier user sees an upgrade prompt is ConciergeSetup.jsx itself.
function DashboardConcierge({ profile }) {
  const { tr } = useLocalizedText('concierge');
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(CONCIERGE_PROMPT_DISMISS_KEY) === '1');
  const [request, setRequest] = useState(undefined);
  const [requestLoadFailed, setRequestLoadFailed] = useState(false);
  const [requestRetry, setRequestRetry] = useState(0);

  useEffect(() => {
    if (isDemoMode() || !profile?.id || profile.role === 'crew' || !CONCIERGE_PROMPT_TIERS.includes(profile.tier)) return;
    let active = true;
    (async () => {
      const res = await supabase.rpc('get_my_concierge_request');
      if (!active) return;
      const next = conciergeRequestRpcState(res);
      setRequest(next.request);
      setRequestLoadFailed(next.loadFailed);
    })().catch(() => {
      if (!active) return;
      setRequest(null);
      setRequestLoadFailed(true);
    });
    return () => { active = false; };
  }, [profile?.id, profile?.role, profile?.tier, requestRetry]);

  const hasStatus = isActiveOrDoneConciergeRequest(request) || request?.status === 'skipped';
  const view = dashboardConciergeView({ demoMode: isDemoMode(), profile, request, dismissed, hasStatus });
  if (view === 'hidden' || view === 'loading') return null;
  if (view === 'status') {
    return (
      <Link to="/app/settings" className="card p-4 mb-4 block no-underline border-brand/30">
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] dark:text-[var(--color-text-secondary)] mb-2">{tr('Concierge setup')}</p>
        <ConciergeStatus request={request} compact />
      </Link>
    );
  }
  function dismiss() {
    localStorage.setItem(CONCIERGE_PROMPT_DISMISS_KEY, '1');
    setDismissed(true);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 dark:bg-black/70" onClick={dismiss} aria-hidden="true" />
      <div role="dialog" aria-modal="true" aria-labelledby="concierge-prompt-title" className="relative bg-[var(--color-surface)] dark:bg-gray-900 rounded-2xl shadow-xl max-w-sm w-full p-6 space-y-4">
        <button autoFocus onClick={dismiss} aria-label={tr('Close')} className="absolute top-3 right-3 text-[var(--color-text-muted)] dark:text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] dark:hover:text-white transition-colors min-w-10 min-h-10 flex items-center justify-center">
          <X className="w-5 h-5" />
        </button>
        <h3 id="concierge-prompt-title" className="text-lg font-bold text-[var(--color-text-primary)] dark:text-white pr-6">
          {tr('We import your clients and prepare your first operating week within 48 hours.')}
        </h3>
        {requestLoadFailed && (
          <div role="alert" className="text-sm text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 rounded-lg p-3">
            <p>{tr('We could not check your concierge status. You can still claim setup, or try again.')}</p>
            <button type="button" className="font-semibold underline mt-2" onClick={() => { setRequest(undefined); setRequestLoadFailed(false); setRequestRetry(value => value + 1); }}>
              {tr('Try again')}
            </button>
          </div>
        )}
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

export default function Dashboard() {
  const { tr } = useLocalizedText('dashboard');
  const { user } = useContext(AuthContext);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [profile, setProfile] = useState(null);
  const [teamProgress, setTeamProgress] = useState([]);
  const [teamError, setTeamError] = useState('');
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let mounted = true;
    // Reset state on user change to prevent stale data leak
    setLoading(true);
    setError('');
    setStats(null);
    setProfile(null);
    setTeamProgress([]);
    setTeamError('');
    async function fetchStats() {
      try {
        const [jobs, invoices, profile] = await Promise.all([
          loadJobs(), loadInvoices(), loadProfile(),
        ]);
        if (!mounted) return;
        if (!profile) throw new Error(tr('Unable to load dashboard profile.'));

        const normalizedProfile = { ...profile, tier: profile.tier || 'free' };
        setProfile(normalizedProfile);
        setStats(summarizeDashboard(jobs, invoices));

        if (hasTeamAccess(normalizedProfile)) {
          try {
            const progress = await loadTeamDashboard(localDate());
            if (mounted) setTeamProgress(progress);
          } catch (teamLoadError) {
            console.error('Dashboard loadTeamDashboard:', teamLoadError);
            if (mounted) setTeamError(tr('Team progress is temporarily unavailable.'));
          }
        }
      } catch (err) {
        console.error('Dashboard fetchStats:', err);
        if (mounted) setError(err.message || 'Failed to load dashboard');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    fetchStats();
    return () => { mounted = false; };
  }, [user, retryKey, tr]);

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

  // Fail closed: only a confirmed owner profile may see business revenue.
  if (profile?.role !== 'owner') {
    return (
      <div>
        <h2 className="text-xl font-bold text-[var(--color-text-primary)] dark:text-white mb-5">{tr('Dashboard')}</h2>
        <LeadTouchPing />
        <p className="text-sm text-[var(--color-text-secondary)] dark:text-[var(--color-text-muted)] mb-4">{tr('Your assigned work')}</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="card p-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mb-2.5">
              <CheckCircle className="w-5 h-5 text-brand-hover dark:text-emerald-400" />
            </div>
            <p className="text-2xl font-bold text-[var(--color-text-primary)] dark:text-white">{stats.todayJobsTotal}</p>
            <p className="text-sm font-semibold text-[var(--color-text-primary)] dark:text-gray-300 mt-0.5">{tr('Assigned Today')}</p>
            <p className="text-xs text-[var(--color-text-muted)] dark:text-[var(--color-text-secondary)] mt-0.5">{stats.todayJobsDone} {tr('done')} · {stats.todayJobsInProgress} {tr('in progress')}</p>
          </div>
          <div className="card p-4">
            <div className="w-10 h-10 rounded-xl bg-sky-100 dark:bg-sky-900/30 flex items-center justify-center mb-2.5">
              <CalendarDays className="w-5 h-5 text-sky-600 dark:text-sky-400" />
            </div>
            <p className="text-2xl font-bold text-[var(--color-text-primary)] dark:text-white">{stats.weeklyJobs}</p>
            <p className="text-sm font-semibold text-[var(--color-text-primary)] dark:text-gray-300 mt-0.5">{tr('Assigned Last 7 Days')}</p>
            <p className="text-xs text-[var(--color-text-muted)] dark:text-[var(--color-text-secondary)] mt-0.5">{stats.weeklyJobsDone} {tr('done')}</p>
          </div>
        </div>
        <Link to="/app/today" className="btn-primary w-full mt-4">{tr("View today's route")}</Link>
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
      label: tr('Jobs Last 7 Days'),
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
  const visibleTeamProgress = teamProgressView(teamProgress);

  return (
    <div>
      <h2 className="text-xl font-bold text-[var(--color-text-primary)] dark:text-white mb-5">{tr('Dashboard')}</h2>
      <DashboardConcierge profile={profile} />
      <LeadTouchPing />
      <ReferralSatisfactionBanner />
      <OnboardingChecklist showConcierge={false} />
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
      {hasTeamAccess(profile) && teamError && (
        <p className="mt-4 text-sm text-amber-700 dark:text-amber-400" role="status">{teamError}</p>
      )}
      {hasTeamAccess(profile) && visibleTeamProgress.show && (
        <div className="card p-4 mt-4">
          <div className="flex items-center justify-between gap-3 mb-3">
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)] dark:text-gray-300">{tr('Team Progress Today')}</h3>
            <Link to="/app/today" className="text-xs font-medium text-brand-hover dark:text-emerald-400 hover:underline">{tr('Manage assignments')}</Link>
          </div>
          {visibleTeamProgress.empty ? (
            <p className="text-sm text-[var(--color-text-muted)] dark:text-[var(--color-text-secondary)]">{tr('No team assignments today')}</p>
          ) : (
            <div className="space-y-3">
              {visibleTeamProgress.rows.map(member => {
                const completed = (member.done || 0) + (member.in_progress || 0);
                const pct = member.total > 0 ? Math.round((completed / member.total) * 100) : 0;
                return (
                  <div key={member.id}>
                    <div className="flex items-center justify-between gap-3 text-xs mb-1">
                      <span className="font-medium text-[var(--color-text-primary)] dark:text-gray-300 truncate">{member.name}</span>
                      <span className="text-[var(--color-text-muted)] dark:text-[var(--color-text-secondary)] flex-shrink-0">{completed}/{member.total} {tr('in progress or done')}</span>
                    </div>
                    <div className="w-full bg-[var(--color-surface-secondary)] dark:bg-gray-800 rounded-full h-1.5 overflow-hidden" role="progressbar" aria-label={tr('{{name}} assignment progress', { name: member.name })} aria-valuemin="0" aria-valuemax="100" aria-valuenow={pct}>
                      <div className="h-full bg-brand rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
