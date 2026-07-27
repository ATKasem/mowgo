import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://demo.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'demo-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storageKey: 'mowgo-auth',
  },
});

/** Check if we're connected to a real Supabase project */
export function isDemoMode() {
  // VITE_FORCE_DEMO overrides everything — set on Cloudflare Pages to keep demo accessible
  if (import.meta.env.VITE_FORCE_DEMO === 'true') return true;
  return !import.meta.env.VITE_SUPABASE_URL || supabaseUrl === 'https://demo.supabase.co';
}


