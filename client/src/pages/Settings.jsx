import useLocalizedText from '../i18n/useLocalizedText';
import { useState, useEffect } from 'react';
import { loadProfile, saveProfile, loadTeamMembers, inviteTeamMember, removeTeamMember } from '../lib/data';
import { TEAM_MEMBER_COLORS } from '../lib/constants';
import { isDemoMode } from '../lib/supabase';
import { useAuth } from '../App';
import { openCustomerPortal } from '../lib/payments';
import { Store, Save, CheckCircle, Loader2, Bell, Users, CreditCard, HelpCircle, AlertCircle } from 'lucide-react';
import { Star } from 'lucide-react';
import WebhookSettings from '../components/WebhookSettings';

export default function Settings() {
  const { tr, t, i18n } = useLocalizedText('settings');
  const { user } = useAuth();
  const [profile, setProfile] = useState({ business_name: '', phone: '', tier: 'free' });
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);

  const [notifyOnComplete, setNotifyOnComplete] = useState(() => localStorage.getItem('mf_notify_complete') !== 'false');
  const [notifyOnRain, setNotifyOnRain] = useState(() => localStorage.getItem('mf_notify_rain') !== 'false');
  const [reviewPrompts, setReviewPrompts] = useState(() => localStorage.getItem('mf_review_prompts') !== 'false');
  const [teamMembers, setTeamMembers] = useState([]);
  const [teamLoading, setTeamLoading] = useState(false);
  const [teamError, setTeamError] = useState('');
  const [inviteSuccess, setInviteSuccess] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteSending, setInviteSending] = useState(false);

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

        {/* Help */}
        <div className="card p-5 space-y-3">
          <h3 className="font-semibold text-[var(--color-text-primary)] dark:text-white text-sm flex items-center gap-2"><HelpCircle className="w-4 h-4 text-[var(--color-text-muted)]" />{tr("Help & Support")}</h3>
          <p className="text-sm text-[var(--color-text-secondary)] dark:text-[var(--color-text-muted)]">{tr("Need help? Email us at")} <a href="mailto:hello@mowgo.app" className="text-brand-hover dark:text-emerald-400 hover:underline">hello@mowgo.app</a></p>
          <p className="text-xs text-[var(--color-text-muted)] dark:text-[var(--color-text-secondary)]">{tr("MowGo v1.0 · Built for lawn care crews ·")} <a href="https://mowgo.pages.dev" className="hover:text-brand transition-colors">mowgo.pages.dev</a></p>
        </div>

      </div>
    </div>
  );
}
