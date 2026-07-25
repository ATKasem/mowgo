/**
 * Data Access Layer — Supabase with demo fallback.
 *
 * All functions return data in the same shape regardless of backend,
 * so pages don't need to know whether they're talking to Supabase or demo data.
 */

import { supabase, isDemoMode } from './supabase';
import { demoJobs, demoClients, demoInvoices } from './demoData';

// ===== In-memory demo state (shared across pages) =====
let _jobs = [...demoJobs];
let _clients = [...demoClients];
let _invoices = [...demoInvoices];

/** Listeners notified when demo state changes */
const listeners = new Set();
function notify() { listeners.forEach(fn => fn()); }
export function onDataChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }

function uid() { return crypto.randomUUID ? crypto.randomUUID() : String(Date.now()); }

// ===== Jobs =====

export async function loadJobs() {
  if (isDemoMode()) return [..._jobs];

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('jobs')
    .select('*, clients!left(*)')
    .eq('user_id', user.id)
    .order('route_order', { ascending: true });

  if (error) { console.error('loadJobs:', error); return []; }

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
    } : null,
  }));
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
  }).select('*, clients!left(*)').single();

  if (error) throw error;
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

// ===== Clients =====

export async function loadClients() {
  if (isDemoMode()) return [..._clients];

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('user_id', user.id)
    .order('name');

  if (error) { console.error('loadClients:', error); return []; }

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
  }));
}

export async function createClient(client) {
  if (isDemoMode()) {
    const newClient = { ...client, id: uid() };
    _clients = [..._clients, newClient];
    notify();
    return newClient;
  }
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase.from('clients').insert({
    user_id: user.id,
    name: client.name,
    address: client.address,
    phone: client.phone,
    email: client.email,
    rate: client.rate || 0,
    cleaning_notes: client.service_notes,
    key_code: client.key_code,
    alarm_code: client.alarm_code,
    pet_instructions: client.pet_instructions,
  }).select().single();

  if (error) throw error;
  return { ...data, service_notes: data.cleaning_notes };
}

export async function updateClient(id, updates) {
  if (isDemoMode()) {
    _clients = _clients.map(c => c.id === id ? { ...c, ...updates } : c);
    notify();
    return _clients.find(c => c.id === id);
  }
  const supabaseUpdates = { ...updates };
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

// ===== Invoices =====

export async function loadInvoices() {
  if (isDemoMode()) return [..._invoices];

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('invoices')
    .select('*, clients!left(*)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) { console.error('loadInvoices:', error); return []; }

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

export async function createInvoice(invoice) {
  if (isDemoMode()) {
    const newInvoice = { ...invoice, id: uid(), status: 'unpaid' };
    _invoices = [newInvoice, ..._invoices];
    notify();
    return newInvoice;
  }
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase.from('invoices').insert({
    user_id: user.id,
    client_id: invoice.client_id || invoice.clients?.id,
    amount: invoice.amount,
    status: 'unpaid',
  }).select('*, clients!left(*)').single();

  if (error) throw error;

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
  const { data, error } = await supabase.from('invoices').update(updates).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

// ===== Profile =====

export async function loadProfile() {
  if (isDemoMode()) return { business_name: 'Green Thumb Lawn Care', phone: '405-555-0100', tier: 'solo' };

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).single();
  if (error) { console.error('loadProfile:', error); return null; }
  return data;
}

/**
 * Fields the account owner may edit. `tier` and `stripe_customer_id` are
 * deliberately excluded — those are billing state, set from verified Stripe
 * events, not from the browser.
 */
const EDITABLE_PROFILE_FIELDS = ['business_name', 'phone'];

export async function saveProfile(profile) {
  if (isDemoMode()) return profile;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const updates = {};
  for (const field of EDITABLE_PROFILE_FIELDS) {
    if (profile[field] !== undefined) updates[field] = profile[field];
  }

  // The row is created by the on_auth_user_created trigger, so this is an
  // update rather than an upsert — no INSERT against profiles is needed.
  const { error } = await supabase.from('profiles').update(updates).eq('id', user.id);
  if (error) throw error;
  return { ...profile, ...updates };
}
