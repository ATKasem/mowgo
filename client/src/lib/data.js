/**
 * Data Access Layer — Supabase with demo fallback.
 *
 * All functions return data in the same shape regardless of backend,
 * so pages don't need to know whether they're talking to Supabase or demo data.
 */

import { supabase, isDemoMode } from './supabase';
import { demoJobs, demoClients, demoInvoices, demoTeamMembers } from './demoData';

// ===== In-memory demo state (shared across pages) =====
let _jobs = [...demoJobs];
let _clients = [...demoClients];
let _invoices = [...demoInvoices];
let _teamMembers = [...demoTeamMembers];

/** Listeners notified when demo state changes */
const listeners = new Set();
function notify() { listeners.forEach(fn => fn()); }
export function onDataChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }

function uid() { return crypto.randomUUID ? crypto.randomUUID() : String(Date.now()); }

// ===== Webhook helper =====

/**
 * Fire a webhook event to the send-webhook Edge Function.
 * Non-blocking — errors are logged but never thrown so they
 * don't break the calling flow.
 */
export async function fireWebhook(event, payload = {}) {
  if (isDemoMode()) return;
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.functions.invoke('send-webhook', {
      body: { user_id: user.id, event, payload },
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
  }));
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
  // Fire webhook (non-blocking)
  fireWebhook('customer.created', {
    client_id: data.id,
    name: data.name,
    address: data.address,
    phone: data.phone,
    email: data.email,
    rate: data.rate,
  });
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
  // Fire webhook when invoice is paid (non-blocking)
  if (status === 'paid') {
    fireWebhook('invoice.paid', {
      invoice_id: data.id,
      client_id: data.client_id,
      amount: data.amount,
      paid_at: data.paid_at,
    });
  }
  return data;
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
  return data;
}

export async function saveProfile(profile) {
  if (isDemoMode()) {
    const userId = _currentDemoUserId();
    const idx = _teamMembers.findIndex(m => m.id === userId);
    if (idx >= 0) {
      _teamMembers[idx] = { ..._teamMembers[idx], ...profile };
    }
    notify();
    return profile;
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { business_name, phone, avatar_url } = profile;
  const { error } = await supabase.from('profiles').upsert({
    id: user.id, business_name, phone, avatar_url,
  });
  if (error) throw error;
  return { ...profile, business_name, phone, avatar_url };
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

  return authenticatedApiRequest('/api/team/invite', {
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
