/**
 * Referral helpers — client-side (referral-program-spec-2026-08-06.md).
 */
import { supabase } from './supabase';

const STASH_KEY = 'mowgo_ref_code';
const STASH_TS_KEY = 'mowgo_ref_ts';
const STALE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export function stashingReady() {
  const ts = Number(localStorage.getItem(STASH_TS_KEY) || 0);
  if (!ts || Date.now() - ts > STALE_MS) {
    // Stale or missing — clear so we don't try a dead code
    localStorage.removeItem(STASH_KEY);
    localStorage.removeItem(STASH_TS_KEY);
    return false;
  }
  return !!localStorage.getItem(STASH_KEY);
}

export async function applyStashedRefCode() {
  const code = localStorage.getItem(STASH_KEY);
  if (!code) return { status: 'none' };
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) return { status: 'none' };

  try {
    const res = await supabase.rpc('apply_referral_code', { p_code: code });
    // RPC returns: business_name on success, null for bad code, 'already_referred' for double-submit
    if (res.data === 'already_referred') {
      // Double-submit race — already referred, nothing to apply, drop the stash.
      localStorage.removeItem(STASH_KEY);
      localStorage.removeItem(STASH_TS_KEY);
      return { status: 'none' };
    }
    if (res.data && typeof res.data === 'string') {
      // Consumed — clear the stash only on a confirmed outcome (a transient
      // network failure must NOT lose the referral; it retries next mount).
      localStorage.removeItem(STASH_KEY);
      localStorage.removeItem(STASH_TS_KEY);
      return { status: 'applied', referrerName: res.data };
    }
    // Invalid/stale code — drop the stash, nothing to retry.
    localStorage.removeItem(STASH_KEY);
    localStorage.removeItem(STASH_TS_KEY);
    return { status: 'none' };
  } catch (err) {
    console.warn('applyStashedRefCode failed:', err.message);
    return { status: 'error', message: 'Referral code was invalid' };
  }
}
