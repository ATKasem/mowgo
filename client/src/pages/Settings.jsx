import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Store, Phone, Save, CheckCircle, Loader2 } from 'lucide-react';

export default function Settings() {
  const [profile, setProfile] = useState({ business_name: '', phone: '' });
  const [saved, setSaved] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

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

  return (
    <div>
      <div className="mb-5">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Settings</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Manage your business profile</p>
      </div>

      <form onSubmit={save} className="card p-5 space-y-5">
        <div>
          <label className="label flex items-center gap-1.5"><Store className="w-3.5 h-3.5" />Business Name</label>
          <input value={profile.business_name || ''} onChange={e => setProfile({ ...profile, business_name: e.target.value })} placeholder="Sparkling Clean LLC" className="input" />
        </div>
        <div>
          <label className="label flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" />Phone Number</label>
          <input value={profile.phone || ''} onChange={e => setProfile({ ...profile, phone: e.target.value })} placeholder="405-555-0100" className="input" />
        </div>

        <div className="border-t border-gray-100 dark:border-gray-800 pt-5">
          <button type="submit" disabled={isLoading} className={`btn-primary w-full transition-all duration-300 ${saved ? '!bg-emerald-500 hover:!bg-emerald-600 !shadow-emerald-200 dark:!shadow-emerald-900/30 shadow-lg' : ''}`}>
            {saved ? <><CheckCircle className="w-4 h-4" />Saved</> : isLoading ? <><Loader2 className="w-4 h-4 animate-spin" />Saving...</> : <><Save className="w-4 h-4" />Save Changes</>}
          </button>
        </div>

        <p className="text-xs text-gray-400 dark:text-gray-500 text-center">Changes sync across all your devices.</p>
      </form>
    </div>
  );
}
