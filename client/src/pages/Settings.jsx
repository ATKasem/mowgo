import useLocalizedText from '../i18n/useLocalizedText';
import { useState, useEffect, useRef } from 'react';
import { loadProfile, saveProfile, updateLeadAlertsEnabled, updateRainAlertsEnabled, loadTeamMembers, inviteTeamMember, removeTeamMember, fetchClientsForExport, fetchJobsForExport, fetchInvoicesForExport, fetchLeadsForExport, loadReferralStats } from '../lib/data';
import { downloadCsv, toCsv } from '../lib/csv';
import { TEAM_MEMBER_COLORS, TEAM_ACCESS_TIERS, hasTeamAccess } from '../lib/constants';
import { isDemoMode, supabase } from '../lib/supabase';
import { useAuth } from '../App';
import { openCustomerPortal } from '../lib/payments';
import { Store, Save, CheckCircle, Loader2, Bell, Users, CreditCard, HelpCircle, AlertCircle, Link as LinkIcon, Copy, Download, DollarSign, Gift } from 'lucide-react';
import { Star } from 'lucide-react';
import WebhookSettings from '../components/WebhookSettings';
import ConciergeSetup from '../components/ConciergeSetup';
import ConciergeStatus from '../components/ConciergeStatus';
import TrialBanner from '../components/TrialBanner';
import { isActiveConciergeRequest } from '../lib/concierge-request';
import { createLocationGeocoder, LocationGeocodeCanceledError, LocationGeocodeError, persistProfileWithResolvedLocation } from '../lib/location-geocoder';

function SectionHeader({ children }) {
  return (
    <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] dark:text-[var(--color-text-secondary)] px-1 pt-1">
      {children}
    </h3>
  );
}

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
  const [resolvedLocation, setResolvedLocation] = useState(null);
  const [locationError, setLocationError] = useState('');
  const [locationLoading, setLocationLoading] = useState(false);
  const [conciergeRequest, setConciergeRequest] = useState(undefined);
  const [showConcierge, setShowConcierge] = useState(false);
  const [referralStats, setReferralStats] = useState(null);
  const [referralLoading, setReferralLoading] = useState(true);
  const [referralError, setReferralError] = useState('');
  const [referralCopied, setReferralCopied] = useState(false);

  const [notifyOnComplete, setNotifyOnComplete] = useState(() => localStorage.getItem('mf_notify_complete') !== 'false');
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
  const locationGeocoder = useRef(null);
  const locationUiGeneration = useRef(0);
  const persistedLocationCoordinates = useRef({ latitude: null, longitude: null });
  const settingsMounted = useRef(true);
  if (!locationGeocoder.current) locationGeocoder.current = createLocationGeocoder();

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
    settingsMounted.current = true;
    return () => {
      settingsMounted.current = false;
      if (bookingCopyTimer.current) clearTimeout(bookingCopyTimer.current);
      Object.values(exportTimers.current).forEach(clearTimeout);
      locationUiGeneration.current += 1;
      locationGeocoder.current.cancel();
    };
  }, []);

  useEffect(() => {
    if (isDemoMode() || !user) return;
    let active = true;
    supabase.rpc('get_my_concierge_request')
      .then(({ data, error: claimError }) => {
        if (!active) return;
        if (claimError) console.error('Concierge claim check:', claimError);
        setConciergeRequest(data?.[0] || null);
      });
    return () => { active = false; };
  }, [user]);

  useEffect(() => {
    let active = true;
    setReferralLoading(true);
    loadReferralStats()
      .then(stats => { if (active) setReferralStats(stats); })
      .catch(err => { if (active) setReferralError(err.message || tr('Failed to load referral program')); })
      .finally(() => { if (active) setReferralLoading(false); });
    return () => { active = false; };
  }, [user?.id]);

  useEffect(() => {
    let active = true;
    loadProfile().then(data => {
      if (!active) return;
      if (data) {
        setProfile(data);
        persistedLocationCoordinates.current = {
          latitude: data.latitude ?? null,
          longitude: data.longitude ?? null,
        };
      }
      setProfileLoading(false);
      // Crew and Premium both include team access.
      if (TEAM_ACCESS_TIERS.includes(data?.tier)) {
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
    const saveLocationGeneration = locationUiGeneration.current;
    setSaved(false);
    setIsLoading(true);
    setError('');
    setLocationError('');
    try {
      const saveResult = await persistProfileWithResolvedLocation(
        profile,
        locationQuery,
        locationGeocoder.current,
        saveProfile,
        {
          demoMode: isDemoMode(),
          resolvedLocation,
          profileOnLocationFailure: { ...profile, ...persistedLocationCoordinates.current },
        },
      );
      const profileToSave = saveResult.profile;
      persistedLocationCoordinates.current = {
        latitude: profileToSave.latitude ?? null,
        longitude: profileToSave.longitude ?? null,
      };
      if (!settingsMounted.current) return;
      // Also store locally for clipboard invoice texts
      localStorage.setItem('mf_business_name', profileToSave.business_name || '');
      localStorage.setItem('mf_business_phone', profileToSave.phone || '');
      localStorage.setItem('mf_venmo_handle', profileToSave.venmo_handle || '');
      localStorage.setItem('mf_cashapp_handle', profileToSave.cashapp_handle || '');
      localStorage.setItem('mf_zelle_handle', profileToSave.zelle_handle || '');
      if (saveLocationGeneration !== locationUiGeneration.current) {
        setLocationError(tr('Location changed while saving. Retry to save your changes.'));
      } else {
        setProfile(profileToSave);
        if (saveResult.resolved) setResolvedLocation(saveResult.resolved);
        if (saveResult.locationWarning) {
          setLocationError(tr('Profile saved, but the location could not be updated. Try finding it again.'));
        }
        if (!saveResult.locationWarning) {
          setSaved(true);
          setTimeout(() => setSaved(false), 2500);
        }
      }
    } catch (err) {
      if (!settingsMounted.current) return;
      if (err instanceof LocationGeocodeCanceledError) {
        setLocationError(tr('Location changed while saving. Retry to save your changes.'));
      } else if (err instanceof LocationGeocodeError) {
        setLocationError(tr('Location not found. Try a city, state, or ZIP.'));
      } else {
        setError(err.message || tr('Failed to save profile'));
      }
    }
    if (settingsMounted.current) setIsLoading(false);
  }

  function geocodeLocation() {
    const query = locationQuery.trim();
    if (!query) return;
    const uiGeneration = ++locationUiGeneration.current;
    void (async () => {
      setLocationLoading(true);
      setLocationError('');
      try {
        const resolved = await locationGeocoder.current.resolve(query);
        setProfile(current => ({ ...current, latitude: resolved.latitude, longitude: resolved.longitude }));
        setResolvedLocation(resolved);
      } catch (err) {
        if (err instanceof LocationGeocodeCanceledError) return;
        console.error('geocodeLocation:', err);
        if (uiGeneration === locationUiGeneration.current) {
          setLocationError(tr('Location not found. Try a city, state, or ZIP.'));
        }
      } finally {
        if (uiGeneration === locationUiGeneration.current) setLocationLoading(false);
      }
    })();
  }

  function changeLocationQuery(value) {
    locationUiGeneration.current += 1;
    locationGeocoder.current.cancel();
    setLocationLoading(false);
    setLocationQuery(value);
    setResolvedLocation(null);
    setLocationError('');
  }

  function removeLocation() {
    locationUiGeneration.current += 1;
    locationGeocoder.current.cancel();
    setLocationLoading(false);
    setProfile(current => ({ ...current, latitude: null, longitude: null }));
    setLocationQuery('');
    setResolvedLocation(null);
    setLocationError('');
  }

  async function toggleLeadAlerts(val) {
    const previous = profile.lead_alerts_enabled;
    setProfile(current => ({ ...current, lead_alerts_enabled: val }));
    try {
      await updateLeadAlertsEnabled(val);
    } catch (err) {
      console.error('updateLeadAlertsEnabled:', err);
      setProfile(current => ({ ...current, lead_alerts_enabled: previous }));
    }
  }
  function toggleNotifyComplete(val) {
    setNotifyOnComplete(val);
    localStorage.setItem('mf_notify_complete', val);
  }
  async function toggleNotifyRain(val) {
    const previous = profile.rain_alerts_enabled;
    setProfile(current => ({ ...current, rain_alerts_enabled: val }));
    try {
      await updateRainAlertsEnabled(val);
    } catch (err) {
      console.error('updateRainAlertsEnabled:', err);
      setProfile(current => ({ ...current, rain_alerts_enabled: previous }));
    }
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

  const isTeamOwner = hasTeamAccess(profile);
  const owner = teamMembers.find(member => member.role === 'owner');
  const conciergeEligible = ['solo', 'crew', 'premium'].includes(profile?.tier);
  const activeConciergeRequest = isActiveConciergeRequest(conciergeRequest);

  return (
    <div>
      <div className="mb-5">
        <h2 className="text-xl font-bold text-[var(--color-text-primary)] dark:text-white">{tr("More")}</h2>
        <p className="text-sm text-[var(--color-text-secondary)] dark:text-[var(--color-text-muted)] mt-0.5">{tr("Manage your business profile and preferences")}</p>
      </div>

      <div className="space-y-5">

        <SectionHeader>{tr("Business")}</SectionHeader>

        {/* Business Profile */}
        <form onSubmit={save} className="card p-5 space-y-4">
          <h4 className="font-semibold text-[var(--color-text-primary)] dark:text-white text-sm flex items-center gap-2"><Store className="w-4 h-4 text-brand" />{tr("Business Profile")}</h4>
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
                    onChange={event => changeLocationQuery(event.target.value)}
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
                {resolvedLocation && <p className="text-xs text-[var(--color-text-muted)] dark:text-[var(--color-text-secondary)]">📍 {resolvedLocation.label}</p>}
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
              <button type="submit" disabled={isLoading || locationLoading || profileLoading} className={`btn-primary w-full transition-all duration-300 ${saved ? '!bg-brand hover:!bg-brand-hover !shadow-emerald-200 dark:!shadow-emerald-900/30 shadow-lg' : ''}`}>
                {saved ? <><CheckCircle className="w-4 h-4" />{tr("Saved")}</> : isLoading ? <><Loader2 className="w-4 h-4 animate-spin" />{tr("Saving...")}</> : <><Save className="w-4 h-4" />{tr("Save Changes")}</>}
              </button>
              <p className="text-xs text-[var(--color-text-muted)] dark:text-[var(--color-text-secondary)] text-center">{tr("Changes sync across all your devices.")}</p>
            </>
          )}
        </form>

        <SectionHeader>{tr('Referrals')}</SectionHeader>
        <div className="card p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Gift className="w-4 h-4 text-brand" />
            <h4 className="font-semibold text-[var(--color-text-primary)] dark:text-white text-sm">{tr('Give a month, earn a month')}</h4>
          </div>
          {referralLoading ? <div className="flex justify-center py-5"><Loader2 className="w-5 h-5 text-brand animate-spin" /></div> : referralError ? (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">{referralError}</p>
          ) : referralStats?.code ? (
            <>
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl bg-gray-50 dark:bg-gray-800/60 p-4">
                <code className="font-mono text-2xl font-bold tracking-[0.18em] text-brand">{referralStats.code}</code>
                <button type="button" className="btn-secondary sm:ml-auto" onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(referralStats.code);
                    setReferralCopied(true); setTimeout(() => setReferralCopied(false), 1500);
                  } catch { setReferralError(tr('Unable to copy referral code')); }
                }}><Copy className="w-4 h-4" />{referralCopied ? tr('Copied!') : tr('Copy code')}</button>
                <button type="button" className="btn-primary" onClick={async () => {
                  const link = `https://mowgoapp.com?ref=${encodeURIComponent(referralStats.code)}`;
                  try {
                    if (navigator.share) await navigator.share({ title: 'MowGo', text: tr('Try MowGo with my referral code'), url: link });
                    else await navigator.clipboard.writeText(link);
                  } catch (err) { if (err?.name !== 'AbortError') setReferralError(tr('Unable to share referral link')); }
                }}>{tr('Share referral link')}</button>
              </div>
              <p className="text-xs text-[var(--color-text-muted)] break-all">{`https://mowgoapp.com?ref=${referralStats.code}`}</p>
              <p className="text-sm text-[var(--color-text-secondary)] dark:text-[var(--color-text-muted)]">
                {tr("You've referred {{total}} people. {{earned}} have signed up.", { total: referralStats.total_count, earned: referralStats.earned_count })}
              </p>
              <div className="grid grid-cols-1 gap-2">
                {[[tr('Reward balance'), `${referralStats.earned_count ?? 0} ${tr('free months')}`]].map(([label, value]) => (
                  <div key={label} className="rounded-lg border border-gray-100 dark:border-gray-800 p-3 text-center"><div className="text-xl font-bold text-[var(--color-text-primary)] dark:text-white">{value ?? 0}</div><div className="text-xs text-[var(--color-text-muted)]">{label}</div></div>
                ))}
              </div>
            </>
          ) : null}
        </div>

        {!isDemoMode() && conciergeEligible && conciergeRequest !== undefined && !activeConciergeRequest && conciergeRequest?.status !== 'done' && (
          showConcierge ? <ConciergeSetup onDone={(request) => { setConciergeRequest(request); setShowConcierge(false); }} /> : (
            conciergeRequest?.status === 'skipped'
              ? <ConciergeStatus request={conciergeRequest} onRetry={() => setShowConcierge(true)} />
              : <div className="card p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-brand/30">
                  <p className="text-sm font-semibold text-[var(--color-text-primary)] dark:text-white">{conciergeTr('We import your clients and prepare your first operating week within 48 hours.')}</p>
                  <button type="button" className="btn-primary whitespace-nowrap" onClick={() => setShowConcierge(true)}>{conciergeTr('Claim it')}</button>
                </div>
          )
        )}
        {!isDemoMode() && (activeConciergeRequest || conciergeRequest?.status === 'done') && <ConciergeStatus request={conciergeRequest} />}

        {/* Booking Link */}
        <div className="card p-5 space-y-3">
          <h4 className="font-semibold text-[var(--color-text-primary)] dark:text-white text-sm flex items-center gap-2"><LinkIcon className="w-4 h-4 text-brand" />{tr("Booking Link")}</h4>
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

        <SectionHeader>{tr("Billing & Plan")}</SectionHeader>

        {/* Plan Info */}
        <div className="card p-5 space-y-3">
          <h4 className="font-semibold text-[var(--color-text-primary)] dark:text-white text-sm flex items-center gap-2"><CreditCard className="w-4 h-4 text-violet-500" />{tr("Plan")}</h4>
          <TrialBanner />
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

        <SectionHeader>{tr("Preferences")}</SectionHeader>

        {/* Notifications */}
        <div className="card p-5 space-y-4">
          <h4 className="font-semibold text-[var(--color-text-primary)] dark:text-white text-sm flex items-center gap-2"><Bell className="w-4 h-4 text-amber-500" />{tr("Notifications")}</h4>
          {!isDemoMode() && ['solo', 'crew', 'premium'].includes(profile?.tier) && (
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <p className="text-sm font-medium text-[var(--color-text-primary)] dark:text-white">{tr("Lead alerts")}</p>
              <p className="text-xs text-[var(--color-text-secondary)] dark:text-[var(--color-text-muted)]">{tr("Get notified instantly when a new lead comes in")}</p>
            </div>
            <button
              role="switch"
              aria-checked={profile.lead_alerts_enabled !== false}
              aria-label={tr("Lead alerts")}
              onClick={() => toggleLeadAlerts(profile.lead_alerts_enabled === false)}
              className={`relative w-10 h-[22px] rounded-full transition-colors duration-200 ${profile.lead_alerts_enabled !== false ? 'bg-brand' : 'bg-gray-300 dark:bg-gray-700'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-[var(--color-surface)] shadow-sm transition-transform duration-200 ${profile.lead_alerts_enabled !== false ? 'translate-x-[18px]' : ''}`} />
            </button>
          </label>
          )}
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
            {profileLoading ? (
              <span className="w-10 h-[22px] rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse" aria-hidden="true" />
            ) : (
              <button
                role="switch"
                aria-checked={profile.rain_alerts_enabled}
                aria-label={tr("Rain delay notifications")}
                onClick={() => toggleNotifyRain(!profile.rain_alerts_enabled)}
                className={`relative w-10 h-[22px] rounded-full transition-colors duration-200 ${profile.rain_alerts_enabled ? 'bg-brand' : 'bg-gray-300 dark:bg-gray-700'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-[var(--color-surface)] shadow-sm transition-transform duration-200 ${profile.rain_alerts_enabled ? 'translate-x-[18px]' : ''}`} />
              </button>
            )}
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

        <SectionHeader>{tr("Team")}</SectionHeader>

        {/* Team */}
        <div className="card p-5 space-y-3">
          <h4 className="font-semibold text-[var(--color-text-primary)] dark:text-white text-sm flex items-center gap-2"><Users className="w-4 h-4 text-brand" />{tr("Team")}</h4>
          {!TEAM_ACCESS_TIERS.includes(profile?.tier) && (
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
          {/* Crew members — team-enabled tiers only */}
          {TEAM_ACCESS_TIERS.includes(profile?.tier) && !teamLoading && teamMembers.filter(m => m.role !== 'owner').map((m, i) => {
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
          {/* Invite form — team-enabled owners only */}
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

        {(profile?.tier === 'solo' || profile?.tier === 'crew') && (
          <>
            <SectionHeader>{tr("Integrations")}</SectionHeader>
            <WebhookSettings />
          </>
        )}

        <SectionHeader>{tr("Data")}</SectionHeader>

        {/* Data Export */}
        <div className="card p-5 space-y-3">
          <h4 className="font-semibold text-[var(--color-text-primary)] dark:text-white text-sm flex items-center gap-2"><Download className="w-4 h-4 text-brand" />{tr('Export data')}</h4>
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

        <SectionHeader>{tr("Support")}</SectionHeader>

        {/* Help */}
        <div className="card p-5 space-y-3">
          <h4 className="font-semibold text-[var(--color-text-primary)] dark:text-white text-sm flex items-center gap-2"><HelpCircle className="w-4 h-4 text-[var(--color-text-muted)]" />{tr("Help & Support")}</h4>
          <p className="text-sm text-[var(--color-text-secondary)] dark:text-[var(--color-text-muted)]">{tr("Need help? Email us at")} <a href="mailto:hello@mowgoapp.com" className="text-brand-hover dark:text-emerald-400 hover:underline">hello@mowgoapp.com</a></p>
          <p className="text-xs text-[var(--color-text-muted)] dark:text-[var(--color-text-secondary)]">{tr("MowGo v1.0 · Built for lawn care crews ·")} <a href="https://mowgoapp.com" className="hover:text-brand transition-colors">mowgoapp.com</a></p>
        </div>

      </div>
    </div>
  );
}
