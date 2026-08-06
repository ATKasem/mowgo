import useLocalizedText from '../i18n/useLocalizedText';
import { useState, useEffect, useRef } from 'react';
import { loadProfile, saveProfile, loadTeamMembers, inviteTeamMember, removeTeamMember, fetchClientsForExport, fetchJobsForExport, fetchInvoicesForExport, fetchLeadsForExport } from '../lib/data';
import { downloadCsv, toCsv } from '../lib/csv';
import { TEAM_MEMBER_COLORS } from '../lib/constants';
import { isDemoMode, supabase } from '../lib/supabase';
import { useAuth } from '../App';
import { openCustomerPortal } from '../lib/payments';
import { Store, Save, CheckCircle, Loader2, Bell, Users, CreditCard, HelpCircle, AlertCircle, Link as LinkIcon, Copy, Download, DollarSign } from 'lucide-react';
import { Star } from 'lucide-react';
import WebhookSettings from '../components/WebhookSettings';
import ConciergeSetup from '../components/ConciergeSetup';

export default function Settings() {
  const { tr, t, i18n } = useLocalizedText('settings');
  const { tr: conciergeTr } = useLocalizedText('concierge');
  const { user } = useAuth();
  const [profile, setProfile] = useState({ business_name: '', phone: '', tier: 'free', venmo_handle: '', cashapp_handle: '', zelle_handle: '' });
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);
  const [locationQuery, setLocationQuery] = useState('');
  const [resolvedLocation, setResolvedLocation] = useState('');
  const [locationError, setLocationError] = useState('');
  const [locationLoading, setLocationLoading] = useState(false);
  const [conciergeClaimed, setConciergeClaimed] = useState(null);
  const [showConcierge, setShowConcierge] = useState(false);

  const [notifyOnComplete, setNotifyOnComplete] = useState(() => localStorage.getItem('mf_notify_complete') !== 'false');
  const [notifyOnRain, setNotifyOnRain] = useState(() => localStorage.getItem('mf_notify_rain') !== 'false');
  const [reviewPrompts, setReviewPrompts] = useState(() => localStorage.getItem('mf_review_prompts') !== 'false');
  const [teamMembers, setTeamMembers] = useState([]);
  const [teamLoading, setTeamLoading] = useState(false);
  const [teamError, setTeamError] = useState('');
  const [inviteSuccess, setInviteSuccess] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteSending, setInviteSending] = useState(false);
  const [bookingCopied, setBookingCopied] = useState(false);
  const [exportLoading, setExportLoading] = useState({});
  const [exported, setExported] = useState({});
  const [exportError, setExportError] = useState('');
  const bookingCopyTimer = useRef(null);
  const exportTimers = useRef({});

  // Booking link — use the live domain. Inside Capacitor (Android/iOS shell),
  // window.location.origin is a local scheme (https://localhost) that customers
  // can't reach, so fall back to the public domain.
  const isNativeShell = ['localhost', '127.0.0.1'].includes(window.location.hostname) &&
    window.location.port === '';
  const bookingBase = isNativeShell
    ? 'https://mowgoapp.com'
    : window.location.origin;
  const bookingUrl = `${bookingBase}/#/book/${user?.id || 'your-business-id'}`;

  useEffect(() => {
    return () => {
      if (bookingCopyTimer.current) clearTimeout(bookingCopyTimer.current);
      Object.values(exportTimers.current).forEach(clearTimeout);
    };
  }, []);

  useEffect(() => {
    if (isDemoMode() || !user) return;
    let active = true;
    supabase.from('concierge_requests').select('id').eq('user_id', user.id).maybeSingle()
      .then(({ data, error: claimError }) => {
        if (!active) return;
        if (claimError) console.error('Concierge claim check:', claimError);
        setConciergeClaimed(Boolean(data));
      });
    return () => { active = false; };
  }, [user]);

  useEffect(() => {
    let active = true;
    loadProfile().then(data => {
      if (!active) return;
      if (data) setProfile(data);
      setProfileLoading(false);
      // Load team members when on crew tier
      if (data?.tier === 'crew') {
        setTeamLoading(true);
        loadTeamMembers()
          .then(members => { if (active) setTeamMembers(members); })
          .catch(err => {
            console.error('loadTeamMembers:', err);
            if (active) setTeamError(err.message || tr('Failed to load team members'));
          })
          .finally(() => { if (active) setTeamLoading(false); });
      }
    }).catch(err => {
      console.error('loadProfile:', err);
      if (active) {
        setError(err.message || tr('Failed to load profile'));
        setProfileLoading(false);
      }
    });
    return () => { active = false; };
  }, []);

  async function save(e) {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    try {
      await saveProfile(profile);
      // Also store locally for clipboard invoice texts
      localStorage.setItem('mf_business_name', profile.business_name || '');
      localStorage.setItem('mf_business_phone', profile.phone || '');
      localStorage.setItem('mf_venmo_handle', profile.venmo_handle || '');
      localStorage.setItem('mf_cashapp_handle', profile.cashapp_handle || '');
      localStorage.setItem('mf_zelle_handle', profile.zelle_handle || '');
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      if (isDemoMode()) {
        // Demo mode: treat as success (no backend)
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
      } else {
        setError(err.message || tr('Failed to save profile'));
      }
    }
    setIsLoading(false);
  }

  async function geocodeLocation() {
    const query = locationQuery.trim();
    if (!query || locationLoading) return;
    setLocationLoading(true);
    setLocationError('');
    try {
      const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=en&format=json`);
      if (!response.ok) throw new Error('Geocoding request failed');
      const result = (await response.json()).results?.[0];
      if (!result || !Number.isFinite(result.latitude) || !Number.isFinite(result.longitude)) {
        throw new Error('Location not found');
      }
      setProfile(current => ({ ...current, latitude: result.latitude, longitude: result.longitude }));
      setResolvedLocation([result.name, result.admin1, result.country].filter(Boolean).join(', '));
    } catch (err) {
      console.error('geocodeLocation:', err);
      setLocationError(tr('Location not found. Try a city, state, or ZIP.'));
    } finally {
      setLocationLoading(false);
    }
  }

  function removeLocation() {
    setProfile(current => ({ ...current, latitude: null, longitude: null }));
    setLocationQuery('');
    setResolvedLocation('');
    setLocationError('');
  }

  function toggleNotifyComplete(val) {
    setNotifyOnComplete(val);
    localStorage.setItem('mf_notify_complete', val);
  }
  function toggleNotifyRain(val) {
    setNotifyOnRain(val);
    localStorage.setItem('mf_notify_rain', val);
  }
  function toggleReviewPrompts(val) {
    setReviewPrompts(val);
    localStorage.setItem('mf_review_prompts', val);
  }

  async function handleInvite(e) {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setInviteSending(true);
    setTeamError('');
    setInviteSuccess('');
    try {
      const result = await inviteTeamMember(inviteEmail);
      if (result?.id) setTeamMembers(prev => prev.some(member => member.id === result.id) ? prev : [...prev, result]);
      setInviteSuccess(tr(isDemoMode() ? 'Demo member added.' : 'Invitation sent.'));
      setInviteEmail('');
    } catch (err) {
      console.error('Invite failed:', err);
      setTeamError(err.message || tr('Failed to send invitation'));
    } finally {
      setInviteSending(false);
    }
  }

  async function handleRemoveMember(memberId) {
    if (!window.confirm(tr('Remove this team member?'))) return;
    setTeamError('');
    try {
      await removeTeamMember(memberId);
      setTeamMembers(prev => prev.filter(m => m.id !== memberId));
    } catch (err) {
      console.error('Remove member failed:', err);
      setTeamError(err.message || tr('Failed to remove team member'));
    }
  }

  async function handleManageSubscription() {
    setPortalLoading(true);
    setError('');
    try {
      const result = await openCustomerPortal();
      if (result?.error) setError(result.error);
    } catch (err) {
      setError(err.message || tr('Unable to open subscription management'));
    } finally {
      setPortalLoading(false);
    }
  }

  async function handleExport(type, fetchRows) {
    setExportLoading(current => ({ ...current, [type]: true }));
    setExportError('');
    try {
      const rows = await fetchRows();
      const fallbackHeaders = {
        clients: ['id','user_id','name','address','phone','email','rate','created_at'],
        jobs: ['id','user_id','client_id','client_name','assigned_to','title','scheduled_date','scheduled_time','status','notes','route_order','created_at'],
        invoices: ['id','user_id','client_id','client_name','job_id','amount','status','paid_at','created_at'],
        leads: ['id','user_id','name','phone','email','address','source','notes','status','client_id','created_at','updated_at'],
      };
      downloadCsv(`mowgo-${type}.csv`, toCsv(rows, fallbackHeaders[type]));
      setExported(current => ({ ...current, [type]: true }));
      if (exportTimers.current[type]) clearTimeout(exportTimers.current[type]);
      exportTimers.current[type] = setTimeout(() => {
        setExported(current => ({ ...current, [type]: false }));
      }, 2500);
    } catch (err) {
      console.error(`Export ${type} failed:`, err);
      setExportError(tr('Export failed. Please try again.'));
    } finally {
      setExportLoading(current => ({ ...current, [type]: false }));
    }
  }

  const isTeamOwner = profile?.tier === 'crew' && (profile?.role || 'owner') === 'owner';
  const owner = teamMembers.find(member => member.role === 'owner');

  return (
    <div>
      <div className="mb-5">
        <h2 className="text-xl font-bold text-[var(--color-text-primary)] dark:text-white">{tr("Settings")}</h2>
        <p className="text-sm text-[var(--color-text-secondary)] dark:text-[var(--color-text-muted)] mt-0.5">{tr("Manage your business profile and preferences")}</p>
      </div>

      <div className="space-y-5">

        {/* Business Profile */}
        <form onSubmit={save} className="card p-5 space-y-4">
          <h3 className="font-semibold text-[var(--color-text-primary)] dark:text-white text-sm flex items-center gap-2"><Store className="w-4 h-4 text-brand" />{tr("Business Profile")}</h3>
          {profileLoading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 text-brand animate-spin" /></div>
          ) : (
            <>
              <div>
                <label className="label">{tr("Business Name")}</label>
                <input value={profile.business_name || ''} onChange={e => setProfile({ ...profile, business_name: e.target.value })} placeholder={tr("Green Thumb Lawn Care")} className="input" />
              </div>
              <div>
                <label className="label">{tr("Phone Number")}</label>
                <input value={profile.phone || ''} onChange={e => setProfile({ ...profile, phone: e.target.value })} placeholder="405-555-0100" className="input" />
              </div>
              <div className="border-t border-gray-100 dark:border-gray-800 pt-4 space-y-4">
                <div>
                  <h4 className="text-sm font-semibold text-[var(--color-text-primary)] dark:text-white flex items-center gap-2"><DollarSign className="w-4 h-4 text-brand" />{tr("How Clients Pay You")}</h4>
                  <p className="text-xs text-[var(--color-text-muted)] dark:text-[var(--color-text-secondary)] mt-1">{tr("These go in your invoice texts. Zelle is listed first — clients usually pay the first option they see.")}</p>
                </div>
                <div>
                  <label className="label">Zelle</label>
                  <input value={profile.zelle_handle || ''} onChange={e => setProfile({ ...profile, zelle_handle: e.target.value })} placeholder={tr("Phone or email clients use to Zelle you")} className="input" />
                </div>
                <div>
                  <label className="label">Venmo</label>
                  <input value={profile.venmo_handle || ''} onChange={e => setProfile({ ...profile, venmo_handle: e.target.value })} placeholder="@GreenThumb" className="input" />
                </div>
                <div>
                  <label className="label">Cash App</label>
                  <input value={profile.cashapp_handle || ''} onChange={e => setProfile({ ...profile, cashapp_handle: e.target.value })} placeholder="$GreenThumb" className="input" />
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-medium text-brand-hover dark:text-emerald-400">{tr('Why do we ask? Rain Delay uses your location for accurate local forecasts.')}</p>
                <label className="label" htmlFor="business-location">{tr('Business location')}</label>
                <div className="flex gap-2">
                  <input
                    id="business-location"
                    value={locationQuery}
                    onChange={event => { setLocationQuery(event.target.value); setLocationError(''); }}
                    onBlur={() => void geocodeLocation()}
                    placeholder={tr('City, State or ZIP — e.g. Oklahoma City, OK')}
                    className="input flex-1 min-w-0"
                  />
                  <button
                    type="button"
                    onMouseDown={event => event.preventDefault()}
                    onClick={() => void geocodeLocation()}
                    disabled={!locationQuery.trim() || locationLoading}
                    className="btn-secondary px-3 disabled:opacity-50"
                  >
                    {locationLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : tr('Find')}
                  </button>
                </div>
                <p className="text-xs text-[var(--color-text-muted)] dark:text-[var(--color-text-secondary)]">{tr('Used to show your local weather so Rain Delay knows when rain is coming at your location. Never shared with anyone.')}</p>
                {resolvedLocation && <p className="text-xs text-[var(--color-text-muted)] dark:text-[var(--color-text-secondary)]">📍 {resolvedLocation}</p>}
                {locationError && <p role="alert" className="text-xs text-red-600 dark:text-red-400">{locationError}</p>}
                {(profile.latitude != null || profile.longitude != null) && (
                  <button type="button" onClick={removeLocation} className="text-xs font-medium text-[var(--color-text-muted)] hover:text-red-600 dark:hover:text-red-400">
                    × {tr('Remove location')}
                  </button>
                )}
              </div>
              {error && (
                <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 rounded-lg p-3">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              )}
              <button type="submit" disabled={isLoading} className={`btn-primary w-full transition-all duration-300 ${saved ? '!bg-brand hover:!bg-brand-hover !shadow-emerald-200 dark:!shadow-emerald-900/30 shadow-lg' : ''}`}>
                {saved ? <><CheckCircle className="w-4 h-4" />{tr("Saved")}</> : isLoading ? <><Loader2 className="w-4 h-4 animate-spin" />{tr("Saving...")}</> : <><Save className="w-4 h-4" />{tr("Save Changes")}</>}
              </button>
              <p className="text-xs text-[var(--color-text-muted)] dark:text-[var(--color-text-secondary)] text-center">{tr("Changes sync across all your devices.")}</p>
            </>
          )}
        </form>

        {!isDemoMode() && ['solo', 'crew', 'premium'].includes(profile?.tier) && conciergeClaimed === false && (
          showConcierge ? <ConciergeSetup onDone={() => { setConciergeClaimed(true); setShowConcierge(false); }} /> : (
            <div className="card p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-brand/30">
              <p className="text-sm font-semibold text-[var(--color-text-primary)] dark:text-white">{conciergeTr("Free setup: we import your clients and pre-schedule your first 30 days.")}</p>
              <button type="button" className="btn-primary whitespace-nowrap" onClick={() => setShowConcierge(true)}>{conciergeTr('Claim it')}</button>
            </div>
          )
        )}

        {/* Plan Info */}
        <div className="card p-5 space-y-3">
          <h3 className="font-semibold text-[var(--color-text-primary)] dark:text-white text-sm flex items-center gap-2"><CreditCard className="w-4 h-4 text-violet-500" />{tr("Plan")}</h3>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-[var(--color-text-primary)] dark:text-white capitalize">{tr(profile?.tier === 'solo' ? 'Solo Plan' : profile?.tier === 'crew' ? 'Crew Plan' : 'Free Plan')}</p>
              <p className="text-xs text-[var(--color-text-secondary)] dark:text-[var(--color-text-muted)] mt-0.5">{tr(profile?.tier === 'crew' ? 'Unlimited clients · Full team access' : profile?.tier === 'solo' ? 'Unlimited clients · All features' : 'Up to 5 clients · All core features')}</p>
            </div>
            <span className="badge-success text-xs">{tr("Active")}</span>
          </div>
          {(!profile?.tier || profile.tier === 'free') && (
            <div className="text-xs text-[var(--color-text-muted)] dark:text-[var(--color-text-secondary)] pt-2 border-t border-gray-100 dark:border-gray-800">
              {tr("Upgrade to Solo ($39/mo) or Crew ($79/mo) for unlimited clients, offline mode, and more.")}
            </div>
          )}
          {profile?.stripe_customer_id && (
            <button
              type="button"
              onClick={handleManageSubscription}
              disabled={portalLoading}
              className="btn-secondary w-full"
            >
              {portalLoading
                ? <><Loader2 className="w-4 h-4 animate-spin" />{tr('Opening...')}</>
                : <><CreditCard className="w-4 h-4" />{tr('Manage Subscription')}</>}
            </button>
          )}
        </div>

        {/* Notifications */}
        <div className="card p-5 space-y-4">
          <h3 className="font-semibold text-[var(--color-text-primary)] dark:text-white text-sm flex items-center gap-2"><Bell className="w-4 h-4 text-amber-500" />{tr("Notifications")}</h3>
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <p className="text-sm font-medium text-[var(--color-text-primary)] dark:text-white">{tr("Job completion alerts")}</p>
              <p className="text-xs text-[var(--color-text-secondary)] dark:text-[var(--color-text-muted)]">{tr("Get a notification when a job is marked complete")}</p>
            </div>
            <button
              role="switch"
              aria-checked={notifyOnComplete}
              aria-label={tr("Job completion alerts")}
              onClick={() => toggleNotifyComplete(!notifyOnComplete)}
              className={`relative w-10 h-[22px] rounded-full transition-colors duration-200 ${notifyOnComplete ? 'bg-brand' : 'bg-gray-300 dark:bg-gray-700'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-[var(--color-surface)] shadow-sm transition-transform duration-200 ${notifyOnComplete ? 'translate-x-[18px]' : ''}`} />
            </button>
          </label>
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <p className="text-sm font-medium text-[var(--color-text-primary)] dark:text-white">{tr("Rain delay notifications")}</p>
              <p className="text-xs text-[var(--color-text-secondary)] dark:text-[var(--color-text-muted)]">{tr("Alert when rain is forecast for tomorrow's jobs")}</p>
            </div>
            <button
              role="switch"
              aria-checked={notifyOnRain}
              aria-label={tr("Rain delay notifications")}
              onClick={() => toggleNotifyRain(!notifyOnRain)}
              className={`relative w-10 h-[22px] rounded-full transition-colors duration-200 ${notifyOnRain ? 'bg-brand' : 'bg-gray-300 dark:bg-gray-700'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-[var(--color-surface)] shadow-sm transition-transform duration-200 ${notifyOnRain ? 'translate-x-[18px]' : ''}`} />
            </button>
          </label>
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <p className="text-sm font-medium text-[var(--color-text-primary)] dark:text-white">{tr("Review prompts")}</p>
              <p className="text-xs text-[var(--color-text-secondary)] dark:text-[var(--color-text-muted)]">{tr("Show a review prompt after completing jobs")}</p>
            </div>
            <button
              role="switch"
              aria-checked={reviewPrompts}
              aria-label={tr("Review prompts")}
              onClick={() => toggleReviewPrompts(!reviewPrompts)}
              className={`relative w-10 h-[22px] rounded-full transition-colors duration-200 ${reviewPrompts ? 'bg-brand' : 'bg-gray-300 dark:bg-gray-700'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-[var(--color-surface)] shadow-sm transition-transform duration-200 ${reviewPrompts ? 'translate-x-[18px]' : ''}`} />
            </button>
          </label>
        </div>

        {/* Team */}
        <div className="card p-5 space-y-3">
          <h3 className="font-semibold text-[var(--color-text-primary)] dark:text-white text-sm flex items-center gap-2"><Users className="w-4 h-4 text-brand" />{tr("Team")}</h3>
          {profile?.tier !== 'crew' && (
            <p className="text-sm text-[var(--color-text-secondary)] dark:text-[var(--color-text-muted)]">{tr("Team management is available on the Crew plan ($79/mo). Upgrade to add crew members, assign jobs, and track progress.")}</p>
          )}
          {teamError && (
            <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 rounded-lg p-3" role="alert">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {teamError}
            </div>
          )}
          {inviteSuccess && <p className="text-sm text-brand-hover dark:text-emerald-400" role="status">{inviteSuccess}</p>}
          {/* Owner row — always shown */}
          <div className="flex items-center gap-3 p-3 bg-[var(--color-surface-bg)] dark:bg-gray-800/50 rounded-xl">
            <div className="w-9 h-9 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center text-xs font-bold text-emerald-700 dark:text-emerald-400">
              {(owner?.business_name || profile?.business_name || user?.email || 'YO').slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[var(--color-text-primary)] dark:text-white truncate">{owner?.business_name || profile?.business_name || (user?.email?.split('@')?.[0]) || 'You'}</p>
              <p className="text-xs text-[var(--color-text-muted)] dark:text-[var(--color-text-secondary)]">{tr("Owner")}</p>
            </div>
          </div>
          {teamLoading && (
            <div className="flex items-center justify-center py-4" aria-label={tr("Loading team members")}>
              <Loader2 className="w-5 h-5 text-brand animate-spin" />
            </div>
          )}
          {/* Crew members — crew tier only */}
          {profile?.tier === 'crew' && !teamLoading && teamMembers.filter(m => m.role !== 'owner').map((m, i) => {
            const color = TEAM_MEMBER_COLORS[(i + 1) % TEAM_MEMBER_COLORS.length];
            return (
              <div key={m.id} className="flex items-center gap-3 p-3 bg-[var(--color-surface-bg)] dark:bg-gray-800/50 rounded-xl">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold ${color.bg} ${color.text}`}>
                  {(m.business_name || '??').slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--color-text-primary)] dark:text-white truncate">{m.business_name}</p>
                  <p className="text-xs text-[var(--color-text-muted)] dark:text-[var(--color-text-secondary)]">{tr("Crew Member")}</p>
                </div>
                {isTeamOwner && (
                  <button
                    type="button"
                    onClick={() => handleRemoveMember(m.id)}
                    className="text-gray-300 dark:text-[var(--color-text-secondary)] hover:text-red-500 dark:hover:text-red-400 transition-colors p-2 min-w-10 min-h-10"
                    aria-label={tr('Remove {{name}}', { name: m.business_name || tr('team member') })}
                  >
                    ✕
                  </button>
                )}
              </div>
            );
          })}
          {/* Invite form — crew tier only */}
          {isTeamOwner && (
            <form onSubmit={handleInvite} className="flex flex-col sm:flex-row gap-2 pt-2">
              <input
                type="email"
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                placeholder={tr("Email to invite...")}
                className="input flex-1 min-w-0"
                required
              />
              <button type="submit" disabled={inviteSending} className="btn-primary text-xs gap-1.5 whitespace-nowrap sm:w-auto w-full">
                {inviteSending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Users className="w-3.5 h-3.5" />}
                {tr("Send Invite")}
              </button>
            </form>
          )}
        </div>

        {/* Zapier Webhooks */}
        {(profile?.tier === 'solo' || profile?.tier === 'crew') && <WebhookSettings />}

        {/* Booking Link */}
        <div className="card p-5 space-y-3">
          <h3 className="font-semibold text-[var(--color-text-primary)] dark:text-white text-sm flex items-center gap-2"><LinkIcon className="w-4 h-4 text-brand" />{tr("Booking Link")}</h3>
          <p className="text-sm text-[var(--color-text-secondary)] dark:text-[var(--color-text-muted)]">{tr("Share this link so customers can book online — no login needed.")}</p>
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={bookingUrl}
              className="input flex-1 text-xs font-mono bg-[var(--color-surface-bg)] dark:bg-gray-800/50"
              onClick={e => e.target.select()}
            />
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(bookingUrl).then(() => {
                  setBookingCopied(true);
                  if (bookingCopyTimer.current) clearTimeout(bookingCopyTimer.current);
                  bookingCopyTimer.current = setTimeout(() => setBookingCopied(false), 2000);
                });
              }}
              className="btn-secondary whitespace-nowrap"
            >
              {bookingCopied ? <><CheckCircle className="w-4 h-4" />{tr("Copied!")}</> : <><Copy className="w-4 h-4" />{tr("Copy")}</>}
            </button>
          </div>
        </div>

        {/* Data Export */}
        <div className="card p-5 space-y-3">
          <h3 className="font-semibold text-[var(--color-text-primary)] dark:text-white text-sm flex items-center gap-2"><Download className="w-4 h-4 text-brand" />{tr('Export data')}</h3>
          <p className="text-sm text-[var(--color-text-secondary)] dark:text-[var(--color-text-muted)]">{tr('Download your business data as CSV. Your data, yours to keep.')}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {[
              ['clients', 'Export Clients', fetchClientsForExport],
              ['jobs', 'Export Jobs', fetchJobsForExport],
              ['invoices', 'Export Invoices', fetchInvoicesForExport],
              ['leads', 'Export Leads', fetchLeadsForExport],
            ].map(([type, label, fetchRows]) => (
              <button
                key={type}
                type="button"
                disabled={exportLoading[type]}
                onClick={() => handleExport(type, fetchRows)}
                className="btn-secondary w-full disabled:opacity-60"
              >
                {exportLoading[type]
                  ? <><Loader2 className="w-4 h-4 animate-spin" />{tr('Exporting...')}</>
                  : exported[type]
                    ? <><CheckCircle className="w-4 h-4 text-brand" />{tr('Exported')}</>
                    : <><Download className="w-4 h-4" />{tr(label)}</>}
              </button>
            ))}
          </div>
          {exportError && <p role="alert" className="text-xs text-red-600 dark:text-red-400">{exportError}</p>}
        </div>

        {/* Help */}
        <div className="card p-5 space-y-3">
          <h3 className="font-semibold text-[var(--color-text-primary)] dark:text-white text-sm flex items-center gap-2"><HelpCircle className="w-4 h-4 text-[var(--color-text-muted)]" />{tr("Help & Support")}</h3>
          <p className="text-sm text-[var(--color-text-secondary)] dark:text-[var(--color-text-muted)]">{tr("Need help? Email us at")} <a href="mailto:hello@mowgoapp.com" className="text-brand-hover dark:text-emerald-400 hover:underline">hello@mowgoapp.com</a></p>
          <p className="text-xs text-[var(--color-text-muted)] dark:text-[var(--color-text-secondary)]">{tr("MowGo v1.0 · Built for lawn care crews ·")} <a href="https://mowgoapp.com" className="hover:text-brand transition-colors">mowgoapp.com</a></p>
        </div>

      </div>
    </div>
  );
}
