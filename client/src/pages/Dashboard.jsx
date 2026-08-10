import useLocalizedText from '../i18n/useLocalizedText';
import { useState, useEffect, useContext } from 'react';
import { Link } from 'react-router-dom';
import { loadJobs, loadInvoices, loadProfile, loadTeamDashboard, loadLeads, loadClients, getWeatherForLocation, getDayConditions } from '../lib/data';
import { isDemoMode, supabase } from '../lib/supabase';
import { AuthContext } from '../App';
import { FileText, CheckCircle, Users, DollarSign, Loader2, AlertCircle, X, CalendarDays, CloudRain, RefreshCw, AlertTriangle, ArrowRight, Clock } from 'lucide-react';
import OnboardingChecklist from '../components/OnboardingChecklist';
import ConciergeStatus from '../components/ConciergeStatus';
import {
  localDate, summarizeDashboard, todayCommand, upcomingJobs, moneyToCollect,
  unfinishedJobCount, rainRiskDay, rainAffectedJobs, weatherBannerView, attentionItems,
  estimatedRateReview,
} from '../lib/dashboard-metrics';
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
  }, [user?.id, user?.email, user?.created_at]);
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

// Permanent weather banner (design §2): always visible — loading, no-location,
// unavailable, and loaded all render inside the same card so weather context
// never disappears just because the forecast is clear. Rain-risk content is
// the only conditional part and always routes to Today's existing rain-delay flow.
function WeatherBanner({ state, currentConditions, forecastDays, riskDay, riskDayLabel, affectedCount, onRetry }) {
  const { tr } = useLocalizedText('dashboard');
  const weatherCode = currentConditions?.weatherCode;
  const condition = weatherCode === 0 ? tr('Clear')
    : weatherCode === 1 || weatherCode === 2 ? tr('Partly cloudy')
      : weatherCode === 3 ? tr('Overcast')
        : weatherCode === 45 || weatherCode === 48 ? tr('Fog')
          : weatherCode >= 51 && weatherCode <= 67 ? tr('Rain')
            : weatherCode >= 71 && weatherCode <= 77 ? tr('Snow')
              : weatherCode >= 80 && weatherCode <= 82 ? tr('Rain showers')
                : weatherCode >= 85 && weatherCode <= 86 ? tr('Snow showers')
                  : weatherCode >= 95 ? tr('Thunderstorm')
                    : null;

  return (
    <div className="card p-4 mb-4">
      <div className="flex items-center justify-between gap-3 mb-1">
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)] dark:text-gray-300">{tr('Weather')}</h3>
        {state === 'unavailable' && (
          <button onClick={onRetry} className="text-xs font-medium text-brand-hover dark:text-emerald-400 hover:underline inline-flex items-center gap-1">
            <RefreshCw className="w-3.5 h-3.5" />{tr('Retry')}
          </button>
        )}
      </div>

      {state === 'loading' && (
        <p className="text-sm text-[var(--color-text-muted)] dark:text-[var(--color-text-secondary)]">{tr('Checking local weather...')}</p>
      )}

      {state === 'no_location' && (
        <p className="text-sm text-[var(--color-text-muted)] dark:text-[var(--color-text-secondary)]">
          {tr('Add your business location in Settings to see local weather.')}{' '}
          <Link to="/app/settings" className="font-semibold text-brand-hover dark:text-emerald-400 hover:underline">{tr('Open Settings')}</Link>
        </p>
      )}

      {state === 'unavailable' && (
        <p className="text-sm text-[var(--color-text-muted)] dark:text-[var(--color-text-secondary)]">{tr('Weather is temporarily unavailable.')}</p>
      )}

      {state === 'loaded' && (
        <div>
          <div className="flex items-baseline gap-2.5">
            <p className="text-2xl font-bold text-[var(--color-text-primary)] dark:text-white">
              {Number.isFinite(currentConditions?.currentTemp) ? `${Math.round(currentConditions.currentTemp)}°` : '—'}
            </p>
            {Number.isFinite(currentConditions?.windMph) && (
              <p className="text-xs text-[var(--color-text-muted)] dark:text-[var(--color-text-secondary)]">
                {tr('Wind {{value}} mph', { value: Math.round(currentConditions.windMph) })}
              </p>
            )}
          </div>
          {condition && <p className="text-sm text-[var(--color-text-secondary)] dark:text-gray-300 mt-0.5">{condition}</p>}
          {forecastDays.length > 0 && (
            <div className="flex gap-3 mt-2.5 overflow-x-auto">
              {forecastDays.slice(0, 4).map(day => (
                <div key={day.date} className="flex-shrink-0 text-center min-w-[44px]">
                  <p className="text-[11px] text-[var(--color-text-muted)] dark:text-[var(--color-text-secondary)]">
                    {new Date(`${day.date}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short' })}
                  </p>
                  <p className="text-sm font-semibold text-[var(--color-text-primary)] dark:text-white">
                    {Number.isFinite(day.tempMax) ? `${Math.round(day.tempMax)}°` : '—'}
                  </p>
                  <p className="text-[11px] text-sky-600 dark:text-sky-400">{day.rain}%</p>
                </div>
              ))}
            </div>
          )}

          {riskDay && affectedCount > 0 && (
            <Link
              to="/app/today"
              className="mt-3 flex items-center gap-2.5 rounded-xl bg-gradient-to-r from-sky-700 to-blue-700 dark:from-sky-800 dark:to-blue-800 text-white p-3 hover:brightness-110 active:scale-[0.99] transition-all min-h-[44px]"
            >
              <CloudRain className="w-5 h-5 flex-shrink-0" />
              <span className="flex-1 min-w-0 text-left">
                <span className="block text-sm font-bold leading-snug">
                  {tr('Rain {{pct}}% {{day}} — {{count}} jobs affected', { pct: riskDay.rain, day: riskDayLabel, count: affectedCount })}
                </span>
                <span className="block text-xs text-sky-100 mt-0.5">{tr('Review rain delay')}</span>
              </span>
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

// Needs Attention row presentation — one visual mapping per attentionItems() type.
function attentionItemMeta(item, tr) {
  switch (item.type) {
    case 'rain':
      return {
        icon: CloudRain,
        text: tr('Rain {{pct}}% {{day}} — {{count}} jobs affected', {
          pct: item.rainPercent,
          day: (item.date === localDate(1) ? tr('Tomorrow') : tr('Today')).toLowerCase(),
          count: item.count,
        }),
        href: '/app/today',
      };
    case 'overdue_invoices':
      return {
        icon: FileText,
        text: tr('{{count}} overdue invoice · ${{amount}}', { count: item.count, amount: item.amount.toLocaleString() }),
        href: '/app/invoices',
      };
    case 'new_leads':
      return { icon: Users, text: tr('{{count}} new lead', { count: item.count }), href: '/app/clients' };
    case 'estimated_rate_review':
      return { icon: DollarSign, text: tr('{{count}} pricing opportunity — review client rate', { count: item.count }), href: '/app/clients?segment=review' };
    case 'unfinished_jobs':
      return { icon: AlertTriangle, text: tr('{{count}} unfinished job from a previous day', { count: item.count }), href: '/app/today' };
    default:
      return null;
  }
}

export default function Dashboard() {
  const { tr } = useLocalizedText('dashboard');
  const { user } = useContext(AuthContext);
  const [stats, setStats] = useState(null);
  const [jobsData, setJobsData] = useState([]);
  const [invoicesData, setInvoicesData] = useState([]);
  const [leads, setLeads] = useState([]);
  const [reviewClients, setReviewClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [profile, setProfile] = useState(null);
  const [teamProgress, setTeamProgress] = useState([]);
  const [teamError, setTeamError] = useState('');
  const [retryKey, setRetryKey] = useState(0);
  const [weather, setWeather] = useState(null);
  const [dayConditions, setDayConditions] = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(true);
  const [hasBusinessLocation, setHasBusinessLocation] = useState(null);
  const [weatherRetryKey, setWeatherRetryKey] = useState(0);

  useEffect(() => {
    let mounted = true;
    // Reset state on user change to prevent stale data leak
    setLoading(true);
    setError('');
    setStats(null);
    setJobsData([]);
    setInvoicesData([]);
    setLeads([]);
    setReviewClients([]);
    setProfile(null);
    setTeamProgress([]);
    setTeamError('');
    setWeather(null);
    setDayConditions(null);
    setWeatherLoading(true);
    setHasBusinessLocation(null);
    async function fetchStats() {
      try {
        const profile = await loadProfile();
        if (!mounted) return;
        if (!profile) throw new Error(tr('Unable to load dashboard profile.'));

        const normalizedProfile = { ...profile, tier: profile.tier || 'free' };
        setProfile(normalizedProfile);
        const [jobs, invoices, clients] = await Promise.all([
          loadJobs(),
          normalizedProfile.role === 'owner' ? loadInvoices() : Promise.resolve([]),
          normalizedProfile.role === 'owner' ? loadClients().catch(() => []) : Promise.resolve([]),
        ]);
        if (!mounted) return;
        setStats(summarizeDashboard(jobs, invoices));
        setJobsData(jobs);
        setInvoicesData(invoices);
        setReviewClients(clients);

        // Owner-only: leads carry business/revenue-adjacent context that must
        // never surface on the assigned-work-only crew dashboard.
        if (normalizedProfile.role === 'owner') {
          loadLeads().then(rows => { if (mounted) setLeads(rows); }).catch(() => { if (mounted) setLeads([]); });
        }

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

  // Weather is independent of jobs/invoices: it must never block dashboard
  // stats from rendering, so it runs its own fetch/error lifecycle once the
  // profile (and its business location) is known.
  useEffect(() => {
    if (!profile) return;
    let active = true;
    setWeatherLoading(true);
    const lat = profile.latitude ?? profile.lat;
    const lng = profile.longitude ?? profile.lng;
    const hasLocation = lat != null && lng != null;
    setHasBusinessLocation(hasLocation);
    if (!hasLocation) {
      setWeather(null);
      setDayConditions(null);
      setWeatherLoading(false);
      return;
    }
    Promise.all([getWeatherForLocation(lat, lng), getDayConditions(lat, lng)])
      .then(([forecast, conditions]) => {
        if (!active) return;
        setWeather(forecast);
        setDayConditions(conditions);
      })
      .finally(() => { if (active) setWeatherLoading(false); });
    return () => { active = false; };
  }, [profile, weatherRetryKey]);

  // Weather is shared presentation for owners and crew. Only assigned jobs are
  // used for crew rain counts; financial and lead data stay in the owner branch.
  const weatherDays = (weather?.daily?.time || []).map((day, index) => ({
    date: day,
    rain: weather.daily.precipitation_probability_max?.[index] ?? 0,
    tempMax: weather.daily.temperature_2m_max?.[index] ?? null,
  }));
  const weatherState = loading ? 'loading'
    : !profile ? 'unavailable'
      : weatherBannerView(hasBusinessLocation, weatherLoading, weatherDays.length > 0);
  const riskDay = rainRiskDay(weatherDays);
  const riskDayLabel = riskDay ? (riskDay.date === localDate(1) ? tr('Tomorrow') : tr('Today')).toLowerCase() : '';
  const rainAffectedCount = riskDay ? rainAffectedJobs(jobsData, riskDay.date).length : 0;
  const weatherBanner = (
    <WeatherBanner
      state={weatherState}
      currentConditions={dayConditions}
      forecastDays={weatherDays}
      riskDay={riskDay}
      riskDayLabel={riskDayLabel}
      affectedCount={rainAffectedCount}
      onRetry={() => profile ? setWeatherRetryKey(k => k + 1) : setRetryKey(k => k + 1)}
    />
  );

  if (loading) {
    return (
      <div>
        {weatherBanner}
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 text-brand animate-spin" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        {weatherBanner}
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <AlertCircle className="w-8 h-8 text-amber-500" />
          <p className="text-sm text-[var(--color-text-secondary)] dark:text-[var(--color-text-muted)]">{error}</p>
          <button onClick={() => { setError(''); setLoading(true); setRetryKey(k => k + 1); }} className="btn-secondary text-sm">{tr('Retry')}</button>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div>
        {weatherBanner}
        <div className="flex items-center justify-center py-20">
          <AlertCircle className="w-8 h-8 text-amber-500" />
        </div>
      </div>
    );
  }

  // Fail closed: only a confirmed owner profile may see business revenue.
  if (profile?.role !== 'owner') {
    return (
      <div>
        <h2 className="text-xl font-bold text-[var(--color-text-primary)] dark:text-white mb-5">{tr('Dashboard')}</h2>
        <LeadTouchPing />
        {weatherBanner}
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

  const command = todayCommand(jobsData);
  const todayRoute = jobsData
    .filter(job => job.scheduled_date === localDate() && job.status !== 'done')
    .slice()
    .sort((a, b) => (Number.isFinite(a.route_order) ? a.route_order : 9999) - (Number.isFinite(b.route_order) ? b.route_order : 9999));
  const plannedMinutesRemaining = todayRoute.reduce((total, job) => total + (Number(job.duration_minutes) || 0), 0);
  const money = moneyToCollect(invoicesData);
  const upcoming = upcomingJobs(jobsData);
  const unfinished = unfinishedJobCount(jobsData);
  const newLeadCount = leads.filter(lead => lead.status === 'new').length;
  const estimatedRateReviewCount = estimatedRateReview(reviewClients, jobsData).flagged.length;
  const attention = attentionItems({
    rainRisk: riskDay,
    rainAffectedCount,
    overdueInvoiceCount: money.overdueCount,
    overdueInvoiceTotal: money.overdueTotal,
    newLeadCount,
    estimatedRateReviewCount,
    unfinishedJobCount: unfinished,
  });

  return (
    <div>
      <div className="mb-5">
        <h2 className="text-xl font-bold text-[var(--color-text-primary)] dark:text-white">{tr('Dashboard')}</h2>
        <p className="text-sm text-[var(--color-text-muted)] dark:text-[var(--color-text-secondary)] mt-0.5">
          {new Date(`${localDate()}T00:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
      </div>
      <DashboardConcierge profile={profile} />
      <LeadTouchPing />
      <ReferralSatisfactionBanner />
      <OnboardingChecklist showConcierge={false} />

      {weatherBanner}

      <div className="card p-4 mb-4">
        <div className="flex items-center justify-between gap-3 mb-2">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)] dark:text-gray-300">{tr("Today's route")}</h3>
          <Link to="/app/today" className="text-xs font-medium text-brand-hover dark:text-emerald-400 hover:underline inline-flex items-center gap-1">
            {tr("View today's route")}<ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        <p className="text-2xl font-bold text-[var(--color-text-primary)] dark:text-white">
          {tr('{{done}} of {{total}} stops complete', { count: command.total, done: command.done, total: command.total })}
        </p>
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-sm text-[var(--color-text-muted)] dark:text-[var(--color-text-secondary)]">
          <span>{tr('{{count}} in-progress job', { count: command.inProgress })}</span>
          <span>{tr('{{count}} stops left · {{hours}} planned', { count: todayRoute.length, hours: `${Math.floor(plannedMinutesRemaining / 60)}h ${plannedMinutesRemaining % 60}m` })}</span>
        </div>
        {command.nextJob ? (
          <div className="mt-3 flex items-center gap-2.5 rounded-xl bg-[var(--color-surface-secondary)] dark:bg-gray-800 p-3">
            <Clock className="w-4 h-4 flex-shrink-0 text-[var(--color-text-muted)] dark:text-[var(--color-text-secondary)]" />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] uppercase tracking-wide text-[var(--color-text-muted)] dark:text-[var(--color-text-secondary)]">{tr('Next stop')}</p>
              <p className="text-sm font-semibold text-[var(--color-text-primary)] dark:text-white truncate">
                {command.nextJob.clientName || tr('Next job')}{command.nextJob.time ? ` · ${command.nextJob.time}` : ''}
              </p>
              {command.nextJob.address && (
                <p className="text-xs text-[var(--color-text-muted)] dark:text-[var(--color-text-secondary)] truncate">{command.nextJob.address}</p>
              )}
            </div>
          </div>
        ) : command.total > 0 ? (
          <p className="text-sm text-[var(--color-text-muted)] dark:text-[var(--color-text-secondary)] mt-3">{tr('No more jobs today')}</p>
        ) : (
          <div className="mt-3">
            <p className="text-sm text-[var(--color-text-muted)] dark:text-[var(--color-text-secondary)]">{tr('No jobs scheduled today')}</p>
            <Link to="/app/today" className="text-xs font-medium text-brand-hover dark:text-emerald-400 hover:underline mt-1 inline-block">{tr('Add a job')}</Link>
          </div>
        )}
        {todayRoute.length > 0 && (
          <div className="mt-3 space-y-2">
            <p className="text-xs font-semibold text-[var(--color-text-muted)] dark:text-[var(--color-text-secondary)]">{tr('Remaining stops')}</p>
            {todayRoute.slice(0, 3).map((job, index) => (
              <Link key={job.id} to={`/app/today?date=${encodeURIComponent(job.scheduled_date)}`} className="flex items-center gap-3 rounded-xl border border-[var(--color-border)] dark:border-gray-700 p-3 min-h-[48px]">
                <span className="w-6 h-6 rounded-full bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 text-xs font-bold flex items-center justify-center shrink-0">{index + 1}</span>
                <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-[var(--color-text-primary)] dark:text-white truncate">{job.clients?.name || tr('Next job')}</span><span className="block text-xs text-[var(--color-text-muted)] dark:text-[var(--color-text-secondary)]">{job.scheduled_time || tr('Time not set')} · {job.duration_minutes || 0} min</span></span>
                <ArrowRight className="w-4 h-4 flex-shrink-0 text-[var(--color-text-muted)] dark:text-[var(--color-text-secondary)]" />
              </Link>
            ))}
            {todayRoute.length > 3 && <Link to="/app/today" className="block text-xs font-medium text-brand-hover dark:text-emerald-400 hover:underline pt-1">{tr('View {{count}} more stops', { count: todayRoute.length - 3 })}</Link>}
          </div>
        )}
      </div>

      <div className="card p-4 mb-4">
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)] dark:text-gray-300 mb-3">{tr('Needs Attention')}</h3>
        {attention.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)] dark:text-[var(--color-text-secondary)]">{tr('Nothing needs attention right now.')}</p>
        ) : (
          <div className="space-y-2">
            {attention.map(item => {
              const meta = attentionItemMeta(item, tr);
              if (!meta) return null;
              const Icon = meta.icon;
              return (
                <Link
                  key={item.type}
                  to={meta.href}
                  className="flex items-center gap-2.5 rounded-xl bg-[var(--color-surface-secondary)] dark:bg-gray-800 p-3 hover:brightness-95 dark:hover:brightness-110 active:scale-[0.99] transition-all min-h-[44px]"
                >
                  <Icon className="w-4 h-4 flex-shrink-0 text-amber-600 dark:text-amber-400" />
                  <span className="flex-1 min-w-0 text-sm font-medium text-[var(--color-text-primary)] dark:text-white">{meta.text}</span>
                  <ArrowRight className="w-4 h-4 flex-shrink-0 text-[var(--color-text-muted)] dark:text-[var(--color-text-secondary)]" />
                </Link>
              );
            })}
          </div>
        )}
      </div>

      <div className="card p-4 mb-4">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div>
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)] dark:text-gray-300">{tr("Today's route")}</h3>
            <p className="text-xs text-[var(--color-text-muted)] dark:text-[var(--color-text-secondary)] mt-0.5">{tr('{{count}} stops left · {{hours}} planned', { count: todayRoute.length, hours: `${Math.floor(plannedMinutesRemaining / 60)}h ${plannedMinutesRemaining % 60}m` })}</p>
          </div>
          <Link to="/app/today" className="text-xs font-medium text-brand-hover dark:text-emerald-400 hover:underline inline-flex items-center gap-1">{tr('Open route')}<ArrowRight className="w-3.5 h-3.5" /></Link>
        </div>
        {todayRoute.length === 0 ? <p className="text-sm text-[var(--color-text-muted)] dark:text-[var(--color-text-secondary)]">{tr('All stops are complete')}</p> : <div className="space-y-2">
          {todayRoute.slice(0, 3).map((job, index) => <Link key={job.id} to={`/app/today?date=${encodeURIComponent(job.scheduled_date)}`} className="flex items-center gap-3 rounded-xl bg-[var(--color-surface-secondary)] dark:bg-gray-800 p-3 min-h-[52px]">
            <span className="w-7 h-7 rounded-full bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 text-xs font-bold flex items-center justify-center shrink-0">{index + 1}</span>
            <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-[var(--color-text-primary)] dark:text-white truncate">{job.clients?.name || tr('Next job')}</span><span className="block text-xs text-[var(--color-text-muted)] dark:text-[var(--color-text-secondary)]">{job.scheduled_time || tr('Time not set')} · {job.duration_minutes || 0} min</span></span>
            <ArrowRight className="w-4 h-4 flex-shrink-0 text-[var(--color-text-muted)] dark:text-[var(--color-text-secondary)]" />
          </Link>)}
          {todayRoute.length > 3 && <Link to="/app/today" className="block text-xs font-medium text-brand-hover dark:text-emerald-400 hover:underline pt-1">{tr('View {{count}} more stops', { count: todayRoute.length - 3 })}</Link>}
        </div>}
      </div>

      <div className="card p-4 mb-4">
        <div className="flex items-center justify-between gap-3 mb-1">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)] dark:text-gray-300">{tr('Money to Collect')}</h3>
          <Link to="/app/invoices" className="text-xs font-medium text-brand-hover dark:text-emerald-400 hover:underline">{tr('View Invoices')}</Link>
        </div>
        <p className="text-2xl font-bold text-[var(--color-text-primary)] dark:text-white">${money.unpaidTotal.toLocaleString()}</p>
        <p className="text-sm text-[var(--color-text-muted)] dark:text-[var(--color-text-secondary)] mt-0.5">
          {money.unpaidCount > 0 ? tr('{{count}} unpaid invoice', { count: money.unpaidCount }) : tr('All invoices current')}
        </p>
        {money.overdueCount > 0 && (
          <p className="text-sm font-semibold text-amber-700 dark:text-amber-400 mt-2">
            {tr('{{count}} overdue invoice · ${{amount}}', { count: money.overdueCount, amount: money.overdueTotal.toLocaleString() })}
          </p>
        )}
      </div>

      {upcoming.length > 0 && (
        <div className="card p-4 mb-4">
          <div className="flex items-center justify-between gap-3 mb-3">
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)] dark:text-gray-300">{tr('Upcoming Jobs')}</h3>
            <span className="text-xs text-[var(--color-text-muted)] dark:text-[var(--color-text-secondary)]">{tr('Next jobs')}</span>
          </div>
          <div className="space-y-2">
            {upcoming.map(job => (
              <Link
                key={job.id}
                to={`/app/today?date=${encodeURIComponent(job.date)}`}
                className="flex items-center justify-between gap-3 rounded-xl bg-[var(--color-surface-secondary)] dark:bg-gray-800 p-3 min-h-[44px]"
              >
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-[var(--color-text-primary)] dark:text-white truncate">
                    {job.clientName || tr('Next job')}
                  </span>
                  <span className="block text-xs text-[var(--color-text-muted)] dark:text-[var(--color-text-secondary)]">
                    {new Date(`${job.date}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                    {job.time ? ` · ${job.time}` : ''}
                  </span>
                  <span className="block text-xs font-medium text-brand-hover dark:text-emerald-400 mt-0.5">
                    {tr(job.status === 'in_progress' ? 'In progress' : job.status === 'scheduled' ? 'Scheduled' : 'Pending')}
                  </span>
                </span>
                <ArrowRight className="w-4 h-4 flex-shrink-0 text-[var(--color-text-muted)] dark:text-[var(--color-text-secondary)]" />
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-3 mb-2">
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)] dark:text-gray-300">{tr('Business snapshot')}</h3>
        <span className="text-xs text-[var(--color-text-muted)] dark:text-[var(--color-text-secondary)]">{tr('Static summary')}</span>
      </div>
      <div className="grid grid-cols-2 gap-3" aria-label={tr('Static business summary')}>
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
