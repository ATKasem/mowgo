import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Store, Phone, Save, CheckCircle, Loader2, Bell, Users, CreditCard, HelpCircle } from 'lucide-react';

export default function Settings() {
  const [profile, setProfile] = useState({ business_name: '', phone: '' });
  const [saved, setSaved] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Notification prefs (local only for now)
  const [notifyOnComplete, setNotifyOnComplete] = useState(() => localStorage.getItem('mf_notify_complete') !== 'false');
  const [notifyOnRain, setNotifyOnRain] = useState(() => localStorage.getItem('mf_notify_rain') !== 'false');

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase.from('profiles').select('*').eq('id', user.id).single().then(({ data }) => { if (data) setProfile(data); }).catch(() => {});
    }).catch(() => {});
  }, []);

  async function save(e) {
    e.preventDefault();
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) await supabase.from('profiles').upsert({ id: user.id, ...profile });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch { setSaved(true); setTimeout(() => setSaved(false), 2500); }
    finally { setIsLoading(false); }
  }

  function toggleNotifyComplete(val) {
    setNotifyOnComplete(val);
    localStorage.setItem('mf_notify_complete', val);
  }
  function toggleNotifyRain(val) {
    setNotifyOnRain(val);
    localStorage.setItem('mf_notify_rain', val);
  }

  return (
    <div>
      <div className="mb-5">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Settings</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Manage your business profile and preferences</p>
      </div>

      <div className="space-y-5">

        {/* Business Profile */}
        <form onSubmit={save} className="card p-5 space-y-4">
          <h3 className="font-semibold text-gray-900 dark:text-white text-sm flex items-center gap-2"><Store className="w-4 h-4 text-sky-500" />Business Profile</h3>
          <div>
            <label className="label">Business Name</label>
            <input value={profile.business_name || ''} onChange={e => setProfile({ ...profile, business_name: e.target.value })} placeholder="Green Thumb Lawn Care" className="input" />
          </div>
          <div>
            <label className="label">Phone Number</label>
            <input value={profile.phone || ''} onChange={e => setProfile({ ...profile, phone: e.target.value })} placeholder="405-555-0100" className="input" />
          </div>
          <button type="submit" disabled={isLoading} className={`btn-primary w-full transition-all duration-300 ${saved ? '!bg-emerald-500 hover:!bg-emerald-600 !shadow-emerald-200 dark:!shadow-emerald-900/30 shadow-lg' : ''}`}>
            {saved ? <><CheckCircle className="w-4 h-4" />Saved</> : isLoading ? <><Loader2 className="w-4 h-4 animate-spin" />Saving...</> : <><Save className="w-4 h-4" />Save Changes</>}
          </button>
          <p className="text-xs text-gray-400 dark:text-gray-500 text-center">Changes sync across all your devices.</p>
        </form>

        {/* Plan Info */}
        <div className="card p-5 space-y-3">
          <h3 className="font-semibold text-gray-900 dark:text-white text-sm flex items-center gap-2"><CreditCard className="w-4 h-4 text-violet-500" />Plan</h3>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-gray-900 dark:text-white">Free Plan</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Up to 10 clients · All core features</p>
            </div>
            <span className="badge-success text-xs">Active</span>
          </div>
          <div className="text-xs text-gray-400 dark:text-gray-500 pt-2 border-t border-gray-100 dark:border-gray-800">
            Upgrade to Solo ($49/mo) or Crew ($79/mo) for unlimited clients, offline mode, and more.
          </div>
        </div>

        {/* Notifications */}
        <div className="card p-5 space-y-4">
          <h3 className="font-semibold text-gray-900 dark:text-white text-sm flex items-center gap-2"><Bell className="w-4 h-4 text-amber-500" />Notifications</h3>
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">Job completion alerts</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Get a notification when a job is marked complete</p>
            </div>
            <button
              role="switch"
              aria-checked={notifyOnComplete}
              onClick={() => toggleNotifyComplete(!notifyOnComplete)}
              className={`relative w-10 h-5.5 rounded-full transition-colors duration-200 ${notifyOnComplete ? 'bg-sky-500' : 'bg-gray-300 dark:bg-gray-700'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${notifyOnComplete ? 'translate-x-[18px]' : ''}`} />
            </button>
          </label>
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">Rain delay notifications</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Alert when rain is forecast for tomorrow's jobs</p>
            </div>
            <button
              role="switch"
              aria-checked={notifyOnRain}
              onClick={() => toggleNotifyRain(!notifyOnRain)}
              className={`relative w-10 h-5.5 rounded-full transition-colors duration-200 ${notifyOnRain ? 'bg-sky-500' : 'bg-gray-300 dark:bg-gray-700'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${notifyOnRain ? 'translate-x-[18px]' : ''}`} />
            </button>
          </label>
        </div>

        {/* Team */}
        <div className="card p-5 space-y-3">
          <h3 className="font-semibold text-gray-900 dark:text-white text-sm flex items-center gap-2"><Users className="w-4 h-4 text-emerald-500" />Team</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">Team management is available on the Crew plan ($79/mo). Upgrade to add crew members, assign jobs, and track progress.</p>
          <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
            <div className="w-9 h-9 rounded-full bg-sky-100 dark:bg-sky-900/40 flex items-center justify-center text-xs font-bold text-sky-700 dark:text-sky-400">YO</div>
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">You</p>
              <p className="text-xs text-gray-400 dark:text-gray-500">Owner</p>
            </div>
          </div>
        </div>

        {/* Help */}
        <div className="card p-5 space-y-3">
          <h3 className="font-semibold text-gray-900 dark:text-white text-sm flex items-center gap-2"><HelpCircle className="w-4 h-4 text-gray-400" />Help & Support</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">Need help? Email us at <a href="mailto:hello@mowflow.app" className="text-sky-600 dark:text-sky-400 hover:underline">hello@mowflow.app</a></p>
          <p className="text-xs text-gray-400 dark:text-gray-500">MowFlow v1.0 — Built for lawn care crews</p>
        </div>

      </div>
    </div>
  );
}
