/**
 * Data Access Layer — Supabase with demo fallback.
 *
 * All functions return data in the same shape regardless of backend,
 * so pages don't need to know whether they're talking to Supabase or demo data.
 */

import { supabase, isDemoMode } from './supabase';
import { demoJobs, demoClients, demoInvoices, demoTeamMembers, demoLeads } from './demoData';

// ===== In-memory demo state (shared across pages) =====
let _jobs = [...demoJobs];
let _clients = [...demoClients];
let _leads = [...demoLeads];
let _invoices = [...demoInvoices];
let _estimates = [
  { id: 'demo-est-1', user_id: 'demo-owner-001', client_id: '1', clients: demoClients[0], amount: 50, status: 'sent', note: 'Weekly lawn care', sent_at: new Date(Date.now() - 86400000 * 5).toISOString(), created_at: new Date(Date.now() - 86400000 * 5).toISOString() },
  { id: 'demo-est-2', user_id: 'demo-owner-001', client_id: '2', clients: demoClients[1], amount: 65, status: 'approved', note: null, approved_at: new Date().toISOString(), created_at: new Date(Date.now() - 86400000).toISOString() },
];
let _teamMembers = [...demoTeamMembers];

/** Listeners notified when demo state changes */
const listeners = new Set();
function notify() { listeners.forEach(fn => fn()); }
export function onDataChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }

function uid() { return crypto.randomUUID ? crypto.randomUUID() : String(Date.now()); }

// ===== Webhook helper =====

/**
 * Fire a webhook event via the /api/webhook-dispatch Cloudflare Pages Function.
 * Non-blocking — errors are logged but never thrown so they
 * don't break the calling flow.
 */
export async function fireWebhook(event, payload = {}) {
  if (isDemoMode()) return;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) return;
    // Best-effort POST — the Pages Function handles auth + delivery
    fetch('/api/webhook-dispatch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ event, payload }),
    }).catch((err) => {
      console.warn('fireWebhook:', event, err?.message || err);
    });
  } catch (err) {
    // Webhook failures must never break the main flow
    console.warn('fireWebhook:', event, err?.message || err);
  }
}

// ===== Jobs =====

export async function loadJobs() {
  if (isDemoMode()) {
    // Crew demo users only see jobs assigned to them
    const profile = _teamMembers.find(m => m.id === _currentDemoUserId());
    if (!profile) return [];
    if (profile.role === 'crew') {
      return _jobs.filter(j => j.assigned_to === profile.id);
    }
    return [..._jobs];
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  // Check if user is a crew member — if so, filter to assigned jobs only
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role, business_id')
    .eq('id', user.id)
    .single();
  if (profileError) {
    console.error('loadJobs: failed to fetch profile, defaulting to owner view', profileError);
  }

  let query = supabase
    .from('jobs')
    .select('*, clients!left(*)')
    .order('route_order', { ascending: true });

  if (profile?.role === 'crew') {
    // Crew sees only jobs assigned to them (RLS also enforces this)
    query = query.eq('assigned_to', user.id);
  } else {
    // Owner sees jobs they own (RLS also enforces this)
    query = query.eq('user_id', user.id);
  }

  const { data, error } = await query;

  if (error) { console.error('loadJobs:', error); throw new Error('Failed to load jobs: ' + (error.message || 'Unknown error')); }

  return (data || []).map(j => ({
    id: j.id,
    client_id: j.client_id,
    title: j.title,
    scheduled_date: j.scheduled_date,
    scheduled_time: j.scheduled_time?.slice(0, 5),
    duration_minutes: j.duration_minutes,
    status: j.status,
    route_order: j.route_order,
    recurrence: j.recurrence_rule || 'none',
    assigned_to: j.assigned_to || null,
    clients: j.clients ? {
      id: j.clients.id,
      name: j.clients.name,
      address: j.clients.address,
      phone: j.clients.phone,
      email: j.clients.email,
      rate: j.clients.rate,
      service_notes: j.clients.cleaning_notes,
      key_code: j.clients.key_code,
      alarm_code: j.clients.alarm_code,
      pet_instructions: j.clients.pet_instructions,
      tags: j.clients.tags || [],
    } : null,
  }));
}

export async function fetchJobsForExport() {
  const mapJob = job => ({
    id: job.id,
    user_id: job.user_id,
    client_id: job.client_id,
    client_name: job.clients?.name ?? job.client_name ?? '',
    assigned_to: job.assigned_to ?? '',
    title: job.title ?? '',
    scheduled_date: job.scheduled_date,
    scheduled_time: job.scheduled_time,
    status: job.status,
    notes: job.notes ?? '',
    route_order: job.route_order ?? '',
    created_at: job.created_at,
  });
  if (isDemoMode()) {
    const profile = _teamMembers.find(m => m.id === _currentDemoUserId());
    if (!profile) return [];
    const jobs = profile.role === 'crew' ? _jobs.filter(j => j.assigned_to === profile.id) : _jobs;
    return jobs.map(mapJob);
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role, business_id')
    .eq('id', user.id)
    .single();
  if (profileError) throw new Error('Failed to load profile: ' + (profileError.message || 'Unknown error'));

  let query = supabase
    .from('jobs')
    .select('*, clients!left(*)')
    .order('route_order', { ascending: true });

  query = profile?.role === 'crew'
    ? query.eq('assigned_to', user.id)
    : query.eq('user_id', user.id);

  const { data, error } = await query;
  if (error) throw new Error('Failed to export jobs: ' + (error.message || 'Unknown error'));
  return (data || []).map(mapJob);
}

export async function createJob(job) {
  if (isDemoMode()) {
    const client = _clients.find(c => c.id === job.client_id);
    const newJob = { ...job, id: uid(), status: 'scheduled', clients: client || null };
    _jobs = [newJob, ..._jobs];
    notify();
    return newJob;
  }
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase.from('jobs').insert({
    user_id: user.id,
    client_id: job.client_id,
    title: job.title,
    scheduled_date: job.scheduled_date,
    scheduled_time: job.scheduled_time,
    duration_minutes: job.duration_minutes,
    status: 'scheduled',
    route_order: job.route_order || 99,
    recurrence_rule: job.recurrence || 'none',
    notes: job.notes || null,
    assigned_to: job.assigned_to || null,
  }).select('*, clients!left(*)').single();

  if (error) throw error;
  // Fire webhook (non-blocking)
  fireWebhook('job.created', {
    job_id: data.id,
    title: data.title,
    client_id: data.client_id,
    scheduled_date: data.scheduled_date,
    status: data.status,
  });
  return {
    id: data.id,
    client_id: data.client_id,
    title: data.title,
    scheduled_date: data.scheduled_date,
    scheduled_time: data.scheduled_time?.slice(0, 5),
    duration_minutes: data.duration_minutes,
    status: data.status,
    route_order: data.route_order,
    recurrence: data.recurrence_rule || 'none',
    assigned_to: data.assigned_to || null,
    clients: data.clients ? {
      id: data.clients.id,
      name: data.clients.name,
      address: data.clients.address,
      phone: data.clients.phone,
      email: data.clients.email,
      rate: data.clients.rate,
      service_notes: data.clients.cleaning_notes,
      key_code: data.clients.key_code,
      alarm_code: data.clients.alarm_code,
      pet_instructions: data.clients.pet_instructions,
      tags: data.clients.tags || [],
    } : null,
  };
}

export async function updateJob(id, updates) {
  if (isDemoMode()) {
    _jobs = _jobs.map(j => j.id === id ? { ...j, ...updates } : j);
    notify();
    return _jobs.find(j => j.id === id);
  }
  const supabaseUpdates = { ...updates };
  if (updates.recurrence !== undefined) {
    supabaseUpdates.recurrence_rule = updates.recurrence;
    delete supabaseUpdates.recurrence;
  }
  if (updates.service_notes !== undefined) {
    supabaseUpdates.cleaning_notes = updates.service_notes;
    delete supabaseUpdates.service_notes;
  }
  const { data, error } = await supabase.from('jobs').update(supabaseUpdates).eq('id', id).select('*, clients!left(*)').single();
  if (error) throw error;
  // Fire webhook when job status changes (non-blocking)
  if (updates.status) {
    fireWebhook('job.updated', {
      job_id: data.id,
      title: data.title,
      client_id: data.client_id,
      scheduled_date: data.scheduled_date,
      status: data.status,
    });
    if (updates.status === 'done') {
      fireWebhook('job.completed', {
        job_id: data.id,
        title: data.title,
        client_id: data.client_id,
        scheduled_date: data.scheduled_date,
      });
    }
  }
  return {
    id: data.id,
    client_id: data.client_id,
    title: data.title,
    scheduled_date: data.scheduled_date,
    scheduled_time: data.scheduled_time?.slice(0, 5),
    duration_minutes: data.duration_minutes,
    status: data.status,
    route_order: data.route_order,
    recurrence: data.recurrence_rule || 'none',
    assigned_to: data.assigned_to || null,
    clients: data.clients ? {
      id: data.clients.id,
      name: data.clients.name,
      address: data.clients.address,
      phone: data.clients.phone,
      email: data.clients.email,
      rate: data.clients.rate,
      service_notes: data.clients.cleaning_notes,
      key_code: data.clients.key_code,
      alarm_code: data.clients.alarm_code,
      pet_instructions: data.clients.pet_instructions,
    } : null,
  };
}

export async function deleteJob(id) {
  if (isDemoMode()) { _jobs = _jobs.filter(j => j.id !== id); notify(); return; }
  const { error } = await supabase.from('jobs').delete().eq('id', id);
  if (error) throw error;
}

export async function updateJobStatus(id, status) {
  return updateJob(id, { status });
}

/** Move a set of jobs to one date. Demo mode updates the shared in-memory store. */
export async function rainDelayJobs(jobIds, targetDate) {
  const ids = [...new Set(jobIds || [])];
  if (!ids.length) return [];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) throw new Error('Invalid target date');

  if (isDemoMode()) {
    const idSet = new Set(ids);
    _jobs = _jobs.map(job => idSet.has(job.id) ? { ...job, scheduled_date: targetDate } : job);
    notify();
    return _jobs.filter(job => idSet.has(job.id));
  }

  // Keep this on updateJob so existing mapping, RLS, and webhook behavior stay consistent.
  return Promise.all(ids.map(id => updateJob(id, { scheduled_date: targetDate })));
}

/**
 * Fire-and-forget: ask the send-rain-delay-sms edge function to text affected clients.
 * Never blocks the rain-delay UI; failures are logged only.
 */
export async function sendRainDelaySms(jobIds, targetDate) {
  if (isDemoMode() || !jobIds?.length) return;
  try {
    const { data, error } = await supabase.functions.invoke('send-rain-delay-sms', {
      body: { jobIds, targetDate },
    });
    if (error) console.warn('Rain-delay SMS failed:', error.message || error);
    else console.info('Rain-delay SMS result:', data);
  } catch (e) {
    console.warn('Rain-delay SMS error:', e?.message || e);
  }
}

async function rainDelayHistoryKey() {
  let userId = _currentDemoUserId();
  if (!isDemoMode()) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    userId = user.id;
  }
  return `mowgo_rain_delay_history_${userId}`;
}

/** Load the current user's local rain-delay history. */
export async function loadRainDelayHistory() {
  try {
    const key = await rainDelayHistoryKey();
    if (!key) return [];
    const parsed = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Add or replace a local rain-delay entry and retain the newest 50. */
export async function saveRainDelayEntry(entry) {
  const key = await rainDelayHistoryKey();
  if (!key) return [];
  const history = await loadRainDelayHistory();
  const next = [entry, ...history.filter(item => item.createdAt !== entry.createdAt)].slice(0, 50);
  try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* storage unavailable */ }
  return next;
}

/** Remove an entry after undoing it. */
export async function removeRainDelayEntry(createdAt) {
  const key = await rainDelayHistoryKey();
  if (!key) return [];
  const next = (await loadRainDelayHistory()).filter(item => item.createdAt !== createdAt);
  try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* storage unavailable */ }
  return next;
}

/** Fetch daily Open-Meteo data for a business location. */
export async function getWeatherForLocation(lat, lng) {
  if (isDemoMode() || !Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) return null;
  try {
    const params = new URLSearchParams({
      latitude: String(lat),
      longitude: String(lng),
      daily: 'precipitation_probability_max,temperature_2m_max',
      timezone: 'auto',
    });
    const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
    if (!response.ok) return null;
    const weather = await response.json();
    return weather?.daily?.time?.length ? weather : null;
  } catch {
    return null;
  }
}

// ===== Clients =====

export async function loadClients() {
  if (isDemoMode()) return [..._clients];

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role, business_id')
    .eq('id', user.id)
    .single();

  if (profileError) {
    console.error('loadClients profile:', profileError);
    throw new Error('Failed to load profile: ' + (profileError.message || 'Unknown error'));
  }

  const ownerId = profile?.role === 'crew' ? profile.business_id : user.id;
  if (!ownerId) return [];

  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('user_id', ownerId)
    .order('name');

  if (error) { console.error('loadClients:', error); throw new Error('Failed to load clients: ' + (error.message || 'Unknown error')); }

  return (data || []).map(c => ({
    id: c.id,
    name: c.name,
    address: c.address,
    phone: c.phone,
    email: c.email,
    rate: c.rate,
    service_notes: c.cleaning_notes,
    key_code: c.key_code,
    alarm_code: c.alarm_code,
    pet_instructions: c.pet_instructions,
    tags: c.tags || [],
  }));
}

export async function fetchClientsForExport() {
  if (isDemoMode()) return [..._clients];

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role, business_id')
    .eq('id', user.id)
    .single();
  if (profileError) throw new Error('Failed to load profile: ' + (profileError.message || 'Unknown error'));

  const ownerId = profile?.role === 'crew' ? profile.business_id : user.id;
  if (!ownerId) return [];

  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('user_id', ownerId)
    .order('name');
  if (error) throw new Error('Failed to export clients: ' + (error.message || 'Unknown error'));
  return data || [];
}

export async function createClient(client) {
  // Free tier limit: max 5 clients
  const FREE_CLIENT_LIMIT = 5;
  const FREE_TIERS = [undefined, null, '', 'free'];

  if (isDemoMode()) {
    const profile = _teamMembers.find(m => m.id === _currentDemoUserId());
    if (FREE_TIERS.includes(profile?.tier) && _clients.length >= FREE_CLIENT_LIMIT) {
      throw new Error(`Free plan is limited to ${FREE_CLIENT_LIMIT} clients. Upgrade to Solo or Crew for unlimited.`);
    }
    const newClient = { ...client, id: uid() };
    _clients = [..._clients, newClient];
    notify();
    return newClient;
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Check tier and client count for free-tier enforcement
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, business_id, tier')
    .eq('id', user.id)
    .single();

  const ownerId = profile?.role === 'crew' ? profile.business_id : user.id;
  if (ownerId && FREE_TIERS.includes(profile?.tier)) {
    const { count } = await supabase
      .from('clients')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', ownerId);
    if ((count || 0) >= FREE_CLIENT_LIMIT) {
      throw new Error(`Free plan is limited to ${FREE_CLIENT_LIMIT} clients. Upgrade to Solo or Crew for unlimited.`);
    }
  }

  const { data, error } = await supabase.from('clients').insert({
    user_id: ownerId,
    name: client.name,
    address: client.address,
    phone: client.phone,
    email: client.email,
    rate: client.rate || 0,
    cleaning_notes: client.service_notes,
    key_code: client.key_code,
    alarm_code: client.alarm_code,
    pet_instructions: client.pet_instructions,
    tags: client.tags || [],
  }).select().single();

  if (error) throw error;
  // Fire webhook (non-blocking)
  fireWebhook('customer.created', {
    client_id: data.id,
    name: data.name,
    address: data.address,
    phone: data.phone,
    email: data.email,
    rate: data.rate,
    tags: data.tags || [],
  });
  return { ...data, service_notes: data.cleaning_notes };
}

export async function updateClient(id, updates) {
  if (isDemoMode()) {
    const { id: _excludeId, ...safeUpdates } = { ...updates };
    _clients = _clients.map(c => c.id === id ? { ...c, ...safeUpdates } : c);
    notify();
    return _clients.find(c => c.id === id);
  }
  const { id: _excludeId, ...supabaseUpdates } = { ...updates };
  if (updates.service_notes !== undefined) { supabaseUpdates.cleaning_notes = updates.service_notes; delete supabaseUpdates.service_notes; }
  const { data, error } = await supabase.from('clients').update(supabaseUpdates).eq('id', id).select().single();
  if (error) throw error;
  return { ...data, service_notes: data.cleaning_notes };
}

export async function deleteClient(id) {
  if (isDemoMode()) { _clients = _clients.filter(c => c.id !== id); notify(); return; }
  const { error } = await supabase.from('clients').delete().eq('id', id);
  if (error) throw error;
}

// ===== Leads =====

export async function loadLeads() {
  if (isDemoMode()) return [..._leads];
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabase.from('leads').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function fetchLeadsForExport() {
  if (isDemoMode()) return [..._leads];
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabase.from('leads').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function createLead(lead) {
  const payload = { name: lead.name.trim(), phone: lead.phone?.trim() || null, email: lead.email?.trim() || null, address: lead.address?.trim() || null, source: lead.source || 'other', notes: lead.notes?.trim() || null, status: 'new' };
  if (isDemoMode()) {
    const now = new Date().toISOString();
    const row = { ...payload, id: uid(), user_id: _currentDemoUserId(), client_id: null, created_at: now, updated_at: now };
    _leads = [row, ..._leads]; notify(); return row;
  }
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  const { data, error } = await supabase.from('leads').insert({ ...payload, user_id: user.id }).select().single();
  if (error) throw error;
  fireWebhook('lead.created', { lead_id: data.id, name: data.name, source: data.source, status: data.status });
  return data;
}

export async function updateLead(id, patch) {
  const safePatch = { ...patch, updated_at: new Date().toISOString() };
  delete safePatch.id; delete safePatch.user_id; delete safePatch.created_at;
  if (isDemoMode()) {
    _leads = _leads.map(lead => lead.id === id ? { ...lead, ...safePatch } : lead); notify();
    return _leads.find(lead => lead.id === id);
  }
  const { data, error } = await supabase.from('leads').update(safePatch).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function updateLeadStatus(id, status) {
  const row = await updateLead(id, { status });
  fireWebhook('lead.status.updated', { lead_id: row.id, name: row.name, status: row.status, client_id: row.client_id });
  return row;
}

export async function deleteLead(id) {
  if (isDemoMode()) { _leads = _leads.filter(lead => lead.id !== id); notify(); return; }
  const { error } = await supabase.from('leads').delete().eq('id', id);
  if (error) throw error;
}

export async function convertLeadToClient(lead) {
  if (!['new', 'contacted', 'quoted'].includes(lead.status)) throw new Error('Only active leads can be converted.');
  const client = await createClient({ name: lead.name, phone: lead.phone || '', email: lead.email || '', address: lead.address || '', rate: 0, service_notes: lead.notes || '', key_code: '', alarm_code: '', pet_instructions: '', tags: [] });
  const updated = await updateLead(lead.id, { client_id: client.id, status: 'won' });
  fireWebhook('lead.status.updated', { lead_id: updated.id, name: updated.name, status: updated.status, client_id: updated.client_id });
  return { client, lead: updated };
}

// ===== Invoices =====

export async function loadInvoices() {
  if (isDemoMode()) {
    const profile = _teamMembers.find(m => m.id === _currentDemoUserId());
    return profile?.role === 'owner' ? [..._invoices] : [];
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('invoices')
    .select('*, clients!left(*)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) { console.error('loadInvoices:', error); throw new Error('Failed to load invoices: ' + (error.message || 'Unknown error')); }

  return (data || []).map(inv => ({
    id: inv.id,
    clients: inv.clients ? {
      id: inv.clients.id,
      name: inv.clients.name,
      address: inv.clients.address,
      phone: inv.clients.phone,
      email: inv.clients.email,
      rate: inv.clients.rate,
      service_notes: inv.clients.cleaning_notes,
    } : null,
    amount: inv.amount,
    status: inv.status,
    created_at: inv.created_at,
    paid_at: inv.paid_at,
  }));
}

export async function fetchInvoicesForExport() {
  const mapInvoice = invoice => ({
    id: invoice.id,
    user_id: invoice.user_id,
    client_id: invoice.client_id,
    client_name: invoice.clients?.name ?? invoice.client_name ?? '',
    job_id: invoice.job_id ?? '',
    amount: invoice.amount,
    status: invoice.status,
    paid_at: invoice.paid_at ?? '',
    created_at: invoice.created_at,
  });
  if (isDemoMode()) {
    const profile = _teamMembers.find(m => m.id === _currentDemoUserId());
    return profile?.role === 'owner' ? _invoices.map(mapInvoice) : [];
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('invoices')
    .select('*, clients!left(*)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });
  if (error) throw new Error('Failed to export invoices: ' + (error.message || 'Unknown error'));
  return (data || []).map(mapInvoice);
}

export async function createInvoice(invoice) {
  const amount = Number(invoice.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Invoice amount must be a positive number');
  }

  if (isDemoMode()) {
    // Dedupe by job_id and always stamp created_at (Nudge eligibility depends on it).
    if (invoice.job_id) {
      const existing = _invoices.find(i => i.job_id === invoice.job_id);
      if (existing) return existing;
    }
    const newInvoice = { ...invoice, amount, id: uid(), status: 'unpaid', created_at: new Date().toISOString() };
    _invoices = [newInvoice, ..._invoices];
    notify();
    return newInvoice;
  }
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Idempotent: a job that's toggled done->todo->done must not double-invoice.
  if (invoice.job_id) {
    const { data: existing, error: lookupError } = await supabase
      .from('invoices')
      .select('id, client_id, amount, status, created_at, job_id')
      .eq('job_id', invoice.job_id)
      .maybeSingle();
    if (lookupError) throw lookupError;
    if (existing) {
      return {
        id: existing.id,
        clients: invoice.clients || null,
        amount: existing.amount,
        status: existing.status,
        created_at: existing.created_at,
      };
    }
  }

  let data;
  try {
    const { data: inserted, error } = await supabase.from('invoices').insert({
      user_id: user.id,
      client_id: invoice.client_id || invoice.clients?.id,
      amount,
      status: 'unpaid',
      job_id: invoice.job_id || null,
    }).select('*, clients!left(*)').single();
    if (error) throw error;
    data = inserted;
  } catch (insertError) {
    // Unique-violation race (23505): another call created it first — return the existing row.
    if (insertError?.code === '23505' && invoice.job_id) {
      const { data: raced, error: raceError } = await supabase
        .from('invoices')
        .select('id, client_id, amount, status, created_at, job_id')
        .eq('job_id', invoice.job_id)
        .maybeSingle();
      if (raceError) throw raceError;
      if (raced) {
        return {
          id: raced.id,
          clients: invoice.clients || null,
          amount: raced.amount,
          status: raced.status,
          created_at: raced.created_at,
        };
      }
    }
    throw insertError;
  }

  return {
    id: data.id,
    clients: data.clients ? {
      id: data.clients.id,
      name: data.clients.name,
      address: data.clients.address,
      phone: data.clients.phone,
      email: data.clients.email,
      rate: data.clients.rate,
      service_notes: data.clients.cleaning_notes,
    } : null,
    amount: data.amount,
    status: data.status,
    created_at: data.created_at,
  };
}

export async function updateInvoiceStatus(id, status) {
  if (isDemoMode()) {
    _invoices = _invoices.map(inv => inv.id === id ? { ...inv, status, ...(status === 'paid' ? { paid_at: new Date().toISOString() } : {}) } : inv);
    notify();
    return _invoices.find(inv => inv.id === id);
  }
  const updates = { status };
  if (status === 'paid') updates.paid_at = new Date().toISOString();
  const { data, error } = await supabase.from('invoices').update(updates).eq('id', id).select('*, clients!left(name)').single();
  if (error) throw error;
  // Fire webhook when invoice is paid (non-blocking)
  if (status === 'paid') {
    fireWebhook('invoice.paid', {
      invoice_id: data.id,
      client_id: data.client_id,
      client_name: data.clients?.name,
      amount: data.amount,
      paid_at: data.paid_at,
    });
  }
  return data;
}

// ===== Estimates =====

export async function loadEstimates() {
  if (isDemoMode()) {
    const profile = _teamMembers.find(m => m.id === _currentDemoUserId());
    return profile?.role === 'owner' ? [..._estimates] : [];
  }
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role === 'crew') return [];
  const { data, error } = await supabase.from('estimates').select('*, clients!left(name)').eq('user_id', user.id).order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function createEstimate(estimate) {
  const amount = Number(estimate.amount);
  if (!estimate.client_id || !Number.isFinite(amount) || amount <= 0) throw new Error('Client and a positive amount are required');
  const now = new Date().toISOString();
  const payload = { ...estimate, amount, sent_at: estimate.status === 'sent' ? now : null };
  if (isDemoMode()) {
    const row = { ...payload, id: uid(), user_id: _currentDemoUserId(), clients: _clients.find(c => c.id === estimate.client_id) || null, created_at: now };
    _estimates = [row, ..._estimates]; notify(); return row;
  }
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  const { data, error } = await supabase.from('estimates').insert({ user_id: user.id, client_id: estimate.client_id, amount, note: estimate.note || null, status: estimate.status, sent_at: payload.sent_at }).select('*, clients!left(name)').single();
  if (error) throw error;
  return data;
}

export async function updateEstimateStatus(id, status) {
  const now = new Date().toISOString();
  const timestamp = status === 'sent' ? 'sent_at' : status === 'approved' ? 'approved_at' : status === 'declined' ? 'declined_at' : null;
  const updates = { status, ...(timestamp ? { [timestamp]: now } : {}) };
  if (isDemoMode()) {
    _estimates = _estimates.map(e => e.id === id ? { ...e, ...updates } : e); notify(); return _estimates.find(e => e.id === id);
  }
  const { data, error } = await supabase.from('estimates').update(updates).eq('id', id).select('*, clients!left(name)').single();
  if (error) throw error;
  return data;
}

export async function convertEstimateToJob(estimate) {
  const job = await createJob({ client_id: estimate.client_id, title: estimate.note || 'Lawn care', scheduled_date: new Date().toISOString().slice(0, 10), scheduled_time: '09:00', duration_minutes: 60, status: 'scheduled' });
  if (isDemoMode()) {
    _estimates = _estimates.map(e => e.id === estimate.id ? { ...e, job_id: job.id } : e); notify(); return _estimates.find(e => e.id === estimate.id);
  }
  const { data, error } = await supabase.from('estimates').update({ job_id: job.id }).eq('id', estimate.id).select('*, clients!left(name)').single();
  if (error) throw error;
  return data;
}

export function estimateText(estimate) {
  return `Hi ${estimate.clients?.name || 'there'}, here's your estimate: $${Number(estimate.amount).toFixed(2)} for lawn care. Valid for 30 days. Thanks!`;
}

export function estimateNudgeText(estimate) {
  const date = new Date(estimate.created_at).toLocaleDateString();
  return `Hi ${estimate.clients?.name || 'there'}, just checking in on your estimate for $${Number(estimate.amount).toFixed(2)} from ${date} — still want me to hold the spot? Happy to adjust anything. Thanks!`;
}

/**
 * Payment methods the operator configured for invoice texts, in preference
 * order (research: clients default to the first option listed — Zelle is the
 * most-used free rail, so it leads).
 */
export function invoicePayMethods() {
  const zelle = (localStorage.getItem('mf_zelle_handle') || '').trim();
  const venmo = (localStorage.getItem('mf_venmo_handle') || '').trim();
  const cashapp = (localStorage.getItem('mf_cashapp_handle') || '').trim();
  const parts = [];
  if (zelle) parts.push(`Zelle: ${zelle}`);
  if (venmo) parts.push(`Venmo: @${venmo.replace(/^@/, '')}`);
  if (cashapp) parts.push(`Cash App: $${cashapp.replace(/^\$/, '')}`);
  return parts;
}

export function invoicePayLine() {
  const methods = invoicePayMethods();
  return methods.length
    ? `Pay via ${methods.join(' · ')}`
    : 'Please send payment at your earliest convenience';
}

/** Friendly reminder for unpaid invoices (mirrors estimateNudgeText). */
export function invoiceNudgeText(invoice) {
  const name = invoice.clients?.name || 'there';
  const amount = Number(invoice.amount || 0).toFixed(2);
  const date = invoice.created_at
    ? new Date(invoice.created_at).toLocaleDateString()
    : '';
  return `Hi ${name} — friendly reminder: $${amount}${date ? ` from ${date}` : ''} is still due. ${invoicePayLine()}. Thanks!`;
}

// ===== Profile =====

export async function loadProfile() {
  if (isDemoMode()) {
    const userId = _currentDemoUserId();
    const member = _teamMembers.find(m => m.id === userId);
    return member || { business_name: 'Green Thumb Lawn Care', phone: '405-555-0100', tier: 'solo', role: 'owner', business_id: null };
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).single();
  if (error) { console.error('loadProfile:', error); return null; }
  // Hydrate the clipboard-text mirrors so invoice texts work on any device
  // the operator signs into (cleared on a fresh profile/account).
  if (data) {
    localStorage.setItem('mf_business_name', data.business_name || '');
    localStorage.setItem('mf_business_phone', data.phone || '');
    localStorage.setItem('mf_venmo_handle', data.venmo_handle || '');
    localStorage.setItem('mf_cashapp_handle', data.cashapp_handle || '');
    localStorage.setItem('mf_zelle_handle', data.zelle_handle || '');
  }
  return data;
}

export async function saveProfile(profile) {
  const normalizeCoordinate = (value, name, min, max) => {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
      throw new Error(`${name} must be a finite number between ${min} and ${max}`);
    }
    return value;
  };
  const latitude = normalizeCoordinate(profile.latitude, 'Latitude', -90, 90);
  const longitude = normalizeCoordinate(profile.longitude, 'Longitude', -180, 180);

  if (isDemoMode()) {
    const userId = _currentDemoUserId();
    const idx = _teamMembers.findIndex(m => m.id === userId);
    if (idx >= 0) {
      _teamMembers[idx] = { ..._teamMembers[idx], ...profile, latitude, longitude };
    }
    notify();
    return { ...profile, latitude, longitude };
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { business_name, phone, avatar_url, venmo_handle, cashapp_handle, zelle_handle } = profile;
  const { error } = await supabase.from('profiles').upsert({
    id: user.id, business_name, phone, avatar_url, latitude, longitude,
    venmo_handle: venmo_handle || null,
    cashapp_handle: cashapp_handle || null,
    zelle_handle: zelle_handle || null,
  });
  if (error) throw error;
  return { ...profile, business_name, phone, avatar_url, latitude, longitude };
}

// ===== Team / Crew =====

let _demoCurrentUserId = 'demo-owner-001';

/** Helper: get the current demo-mode user id (owner by default) */
function _currentDemoUserId() {
  return _demoCurrentUserId;
}

/**
 * Switch which demo user is "logged in".
 * Call this to test crew-mode filtering.
 */
export function setDemoUserId(userId) {
  _demoCurrentUserId = userId;
}

/**
 * Load all team members for the current user's business.
 * Demo mode: returns all demo team members.
 * Real mode: queries profiles where business_id matches the owner.
 */
export async function loadTeamMembers() {
  if (isDemoMode()) {
    const currentMember = _teamMembers.find(m => m.id === _currentDemoUserId());
    if (!currentMember) return [];
    const bizId = currentMember.role === 'owner' ? currentMember.id : currentMember.business_id;
    return _teamMembers.filter(m => m.id === bizId || m.business_id === bizId);
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  // Determine the business_id (owner profile id) for this user
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role, business_id, id')
    .eq('id', user.id)
    .single();

  if (profileError) {
    console.error('loadTeamMembers profile:', profileError);
    throw new Error('Failed to load profile: ' + (profileError.message || 'Unknown error'));
  }
  if (!profile) return [];

  // Owners: their own id is the business_id. Crew: use their business_id.
  const bizId = profile.role === 'owner' ? profile.id : profile.business_id;
  if (!bizId) return [{ ...profile }]; // standalone owner, no crew

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .or(`id.eq.${bizId},business_id.eq.${bizId}`)
    .order('business_name');

  if (error) { console.error('loadTeamMembers:', error); throw new Error('Failed to load team: ' + (error.message || 'Unknown error')); }

  return (data || []).map(m => ({
    id: m.id,
    business_name: m.business_name,
    phone: m.phone,
    avatar_url: m.avatar_url,
    role: m.role || 'owner',
    business_id: m.business_id || null,
    created_at: m.created_at,
  }));
}

async function authenticatedApiRequest(path, options = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Not authenticated');

  const response = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
      ...options.headers,
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || 'Team request failed');
  return payload;
}

export async function reorderJobs(orders) {
  if (isDemoMode()) {
    const routeOrders = new Map(orders.map(({ id, route_order }) => [id, route_order]));
    _jobs = _jobs.map(job => routeOrders.has(job.id)
      ? { ...job, route_order: routeOrders.get(job.id) }
      : job);
    notify();
    return;
  }

  await authenticatedApiRequest('/api/jobs/reorder', {
    method: 'POST',
    body: JSON.stringify({ orders }),
  });
}

export async function inviteTeamMember(email) {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) throw new Error('Email is required');

  if (isDemoMode()) {
    const owner = _teamMembers.find(m => m.id === _currentDemoUserId() && m.role === 'owner');
    if (!owner) throw new Error('Only the team owner can invite members');
    const member = {
      id: `demo-crew-${Date.now()}`,
      business_name: normalizedEmail.split('@')[0],
      email: normalizedEmail,
      phone: '',
      avatar_url: null,
      tier: 'crew',
      role: 'crew',
      business_id: owner.id,
      created_at: new Date().toISOString(),
    };
    _teamMembers = [..._teamMembers, member];
    notify();
    return member;
  }

  return authenticatedApiRequest('/api/invite-crew', {
    method: 'POST',
    body: JSON.stringify({ email: normalizedEmail }),
  });
}

export async function removeTeamMember(memberId) {
  if (isDemoMode()) {
    const owner = _teamMembers.find(m => m.id === _currentDemoUserId() && m.role === 'owner');
    const member = _teamMembers.find(m => m.id === memberId);
    if (!owner || !member || member.business_id !== owner.id) {
      throw new Error('Only the team owner can remove members');
    }
    _teamMembers = _teamMembers.filter(m => m.id !== memberId);
    _jobs = _jobs.map(job => job.assigned_to === memberId ? { ...job, assigned_to: null } : job);
    notify();
    return;
  }

  await authenticatedApiRequest(`/api/team/${encodeURIComponent(memberId)}`, {
    method: 'DELETE',
  });
}

/**
 * Load team dashboard: aggregate job stats per team member for a given date.
 * Returns: [{ id, name, role, total, done, in_progress }]
 */
export async function loadTeamDashboard(date) {
  if (isDemoMode()) {
    const targetDate = date || new Date().toISOString().split('T')[0];
    const currentMember = _teamMembers.find(m => m.id === _currentDemoUserId());
    if (!currentMember) return [];
    const bizId = currentMember.role === 'owner' ? currentMember.id : currentMember.business_id;
    const visibleMembers = currentMember.role === 'crew'
      ? [currentMember]
      : _teamMembers.filter(m => m.id === bizId || m.business_id === bizId);

    return visibleMembers
      .map(member => {
        const memberJobs = _jobs.filter(j =>
          j.scheduled_date === targetDate &&
          (j.assigned_to === member.id || (member.role === 'owner' && !j.assigned_to))
        );
        return {
          id: member.id,
          name: member.business_name,
          role: member.role || 'owner',
          total: memberJobs.length,
          done: memberJobs.filter(j => j.status === 'done').length,
          in_progress: memberJobs.filter(j => j.status === 'in_progress').length,
        };
      });
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const targetDate = date || new Date().toISOString().split('T')[0];

  // Get the business_id for this user
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role, business_id, id')
    .eq('id', user.id)
    .single();

  if (profileError) {
    console.error('loadTeamDashboard profile:', profileError);
    throw new Error('Failed to load profile: ' + (profileError.message || 'Unknown error'));
  }
  if (!profile) return [];

  const bizId = profile.role === 'owner' ? profile.id : profile.business_id;
  if (!bizId) return [];

  // Load team members
  const { data: members, error: membersError } = await supabase
    .from('profiles')
    .select('id, business_name, role')
    .or(`id.eq.${bizId},business_id.eq.${bizId}`);

  if (membersError) {
    console.error('loadTeamDashboard members:', membersError);
    throw new Error('Failed to load team: ' + (membersError.message || 'Unknown error'));
  }
  if (!members?.length) return [];

  // Crew members can only read their own assigned jobs; showing coworkers with
  // zeroes would be misleading.
  const visibleMembers = profile.role === 'crew'
    ? members.filter(member => member.id === user.id)
    : members;

  // Load all jobs for this date across the business
  let jobsQuery = supabase
    .from('jobs')
    .select('assigned_to, status')
    .eq('scheduled_date', targetDate);

  if (profile.role === 'crew') {
    jobsQuery = jobsQuery.eq('assigned_to', user.id);
  } else {
    jobsQuery = jobsQuery.eq('user_id', bizId);
  }

  const { data: jobs, error: jobsError } = await jobsQuery;
  if (jobsError) {
    console.error('loadTeamDashboard jobs:', jobsError);
    throw new Error('Failed to load team jobs: ' + (jobsError.message || 'Unknown error'));
  }

  return visibleMembers.map(m => {
    const memberJobs = (jobs || []).filter(j => j.assigned_to === m.id || (!j.assigned_to && m.id === bizId));
    return {
      id: m.id,
      name: m.business_name,
      role: m.role || 'owner',
      total: memberJobs.length,
      done: memberJobs.filter(j => j.status === 'done').length,
      in_progress: memberJobs.filter(j => j.status === 'in_progress').length,
    };
  });
}

// ===== Job Photos =====

// In-memory demo photo store
const _demoPhotos = new Map();

/**
 * Upload a job photo (before/after) to Supabase storage.
 * @param {string} jobId
 * @param {File} file - image file from input/camera
 * @param {'before'|'after'} type
 * @returns {Promise<string>} one-hour signed URL of the uploaded photo
 */
export async function uploadJobPhoto(jobId, file, type) {
  const timestamp = Date.now();
  const ext = file.name?.split('.').pop() || 'jpg';
  const path = `${jobId}/${type}-${timestamp}.${ext}`;

  if (isDemoMode()) {
    const url = URL.createObjectURL(file);
    const existing = _demoPhotos.get(jobId) || {};
    _demoPhotos.set(jobId, { ...existing, [type]: url });
    return url;
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const storagePath = `${user.id}/${path}`;
  const { error: uploadError } = await supabase.storage
    .from('job-photo')
    .upload(storagePath, file, { contentType: file.type || 'image/jpeg', upsert: true });

  if (uploadError) throw uploadError;

  const { data: urlData, error: signedUrlError } = await supabase.storage
    .from('job-photo')
    .createSignedUrl(storagePath, 3600);

  if (signedUrlError) throw signedUrlError;

  // Store URL on the job record if photo_before/photo_after columns exist
  const colName = type === 'before' ? 'photo_before' : 'photo_after';
  try {
    await supabase.from('jobs').update({ [colName]: urlData.signedUrl }).eq('id', jobId);
  } catch {
    // Column may not exist yet — storage is the source of truth
  }

  return urlData.signedUrl;
}

/**
 * Get before/after photo URLs for a job.
 * @param {string} jobId
 * @returns {Promise<{before: string|null, after: string|null}>}
 */
export async function getJobPhotos(jobId) {
  if (isDemoMode()) {
    const photos = _demoPhotos.get(jobId) || {};
    return { before: photos.before || null, after: photos.after || null };
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { before: null, after: null };

  const folderPath = `${user.id}/${jobId}`;
  const { data: files, error } = await supabase.storage
    .from('job-photo')
    .list(folderPath);

  if (error || !files || files.length === 0) {
    return { before: null, after: null };
  }

  const result = { before: null, after: null };
  for (const f of files) {
    const filePath = `${folderPath}/${f.name}`;
    const { data: urlData, error: signedUrlError } = await supabase.storage
      .from('job-photo')
      .createSignedUrl(filePath, 3600);
    if (signedUrlError) continue;
    if (f.name.startsWith('before-')) result.before = urlData.signedUrl;
    if (f.name.startsWith('after-')) result.after = urlData.signedUrl;
  }
  return result;
}
