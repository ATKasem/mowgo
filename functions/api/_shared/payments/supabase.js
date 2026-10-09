/**
 * Minimal service-role PostgREST helpers for the payments layer.
 * Service role bypasses RLS — every query must filter by an id the caller
 * has already authorized.
 */

import { supabaseConfig } from './http.js';

export const withTimeout = (promise, ms = 4000) =>
  Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error('Supabase timeout')), ms))]);

function serviceHeaders(env, extra = {}) {
  const { serviceKey } = supabaseConfig(env);
  return { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, ...extra };
}

export function requireSupabase(env) {
  const { url, serviceKey } = supabaseConfig(env);
  if (!url || !serviceKey) throw new Error('Supabase server configuration is incomplete');
}

export async function selectRows(env, table, query) {
  const { url } = supabaseConfig(env);
  const res = await withTimeout(fetch(`${url}/rest/v1/${table}?${query}`, { headers: serviceHeaders(env) }));
  if (!res.ok) throw new Error(`select ${table} failed: ${res.status}`);
  const rows = await res.json();
  return Array.isArray(rows) ? rows : [];
}

/** PATCH rows matching `filter`; returns the updated rows. */
export async function patchRows(env, table, filter, patch) {
  const { url } = supabaseConfig(env);
  const res = await withTimeout(fetch(`${url}/rest/v1/${table}?${filter}`, {
    method: 'PATCH',
    headers: serviceHeaders(env, { 'Content-Type': 'application/json', Prefer: 'return=representation' }),
    body: JSON.stringify(patch),
  }));
  if (!res.ok) throw new Error(`update ${table} failed: ${res.status}`);
  const rows = await res.json();
  return Array.isArray(rows) ? rows : [];
}

export async function insertRow(env, table, row, prefer = 'return=minimal') {
  const { url } = supabaseConfig(env);
  return withTimeout(fetch(`${url}/rest/v1/${table}`, {
    method: 'POST',
    headers: serviceHeaders(env, { 'Content-Type': 'application/json', Prefer: prefer }),
    body: JSON.stringify(row),
  }));
}

export async function callRpc(env, fn, params) {
  const { url } = supabaseConfig(env);
  return withTimeout(fetch(`${url}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: serviceHeaders(env, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(params),
  }));
}

export async function fetchUserEmail(env, userId) {
  if (!userId) return null;
  try {
    const { url } = supabaseConfig(env);
    const res = await withTimeout(fetch(`${url}/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
      headers: serviceHeaders(env),
    }));
    if (!res.ok) return null;
    const data = await res.json();
    return data?.email || null;
  } catch {
    return null;
  }
}

export const eq = (value) => `eq.${encodeURIComponent(value)}`;
