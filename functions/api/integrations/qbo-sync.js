/**
 * Cloudflare Pages Function — Sync a MowGo invoice to QuickBooks Online
 *
 * POST /api/integrations/qbo-sync
 * Headers: Authorization: Bearer <supabase-access-token>
 * Body: { event: 'invoice.created'|'invoice.paid'|'invoice.deleted', payload: {...} }
 *
 * payload shape:
 *   invoice.created: { invoiceId, customerName, customerEmail?, amount, description?, dueDate? }
 *   invoice.paid:    { invoiceId, amount }
 *   invoice.deleted: { invoiceId }
 *
 * `invoiceId` is the MowGo invoice id — used as the idempotency key. The
 * mapping to QuickBooks object ids is kept in integrations.metadata.syncMap
 * (this table already stores QBO state and has no client-facing RLS; see
 * supabase/migrations/20260815120000_integrations.sql).
 *
 * Every QBO call goes through qboRequest(), which retries once after a
 * forced token refresh if QBO returns 401 (access token revoked/expired
 * server-side ahead of our stored expiry).
 *
 * Env vars: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY,
 *           QBO_CLIENT_ID, QBO_CLIENT_SECRET
 */

import { getValidAccessToken, refreshQboToken } from '../_shared/qbo-tokens.js';
import { getSupabaseUrl, getSupabaseAnonKey, getSupabaseServiceKey } from '../_shared/qbo-env.js';

const ALLOWED_ORIGINS = ['https://mowgoapp.com'];

/** Per-user+IP rate limit: 20 syncs per 15 min (in-memory, per-isolate — see webhook-dispatch.js). */
const syncAttempts = new Map();
const RATE_LIMIT_MAX = 20;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;

function corsHeaders(request) {
  const origin = request?.headers?.get?.('origin');
  return {
    'Access-Control-Allow-Origin': origin && ALLOWED_ORIGINS.includes(origin) ? origin : 'https://mowgoapp.com',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

function isRateLimited(userId, request) {
  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  const key = `${userId}:${ip}`;
  const now = Date.now();
  const entry = syncAttempts.get(key);
  if (!entry || now >= entry.resetTime) {
    syncAttempts.set(key, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > RATE_LIMIT_MAX;
}

async function verifyToken(token, env) {
  const res = await fetch(`${getSupabaseUrl(env)}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: getSupabaseAnonKey(env) },
  });
  if (!res.ok) return null;
  const user = await res.json();
  return user?.id || null;
}

function qboFetch(accessToken, realmId, method, path, body) {
  return fetch(`https://quickbooks.api.intuit.com/v3/company/${realmId}/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15_000),
  });
}

/** Issues a QBO API call, retrying once after a forced token refresh on 401. */
async function qboRequest(env, tokenInfo, method, path, body) {
  let { accessToken, realmId, integration } = tokenInfo;
  let res = await qboFetch(accessToken, realmId, method, path, body);
  if (res.status === 401) {
    const refreshed = await refreshQboToken(env, integration);
    accessToken = refreshed.access_token;
    realmId = refreshed.realm_id;
    res = await qboFetch(accessToken, realmId, method, path, body);
  }
  let data = null;
  try {
    data = await res.json();
  } catch {
    // empty / non-JSON body
  }
  return { ok: res.ok, status: res.status, data };
}

function qboEscapeStringLiteral(value) {
  return String(value).replace(/'/g, "\\'");
}

async function findOrCreateCustomer(env, tokenInfo, name, email) {
  const query = `select * from Customer where DisplayName = '${qboEscapeStringLiteral(name)}'`;
  const found = await qboRequest(env, tokenInfo, 'GET', `query?query=${encodeURIComponent(query)}`);
  const existing = found.data?.QueryResponse?.Customer?.[0];
  if (existing) return existing.Id;

  const created = await qboRequest(env, tokenInfo, 'POST', 'customer', {
    DisplayName: name,
    ...(email ? { PrimaryEmailAddr: { Address: email } } : {}),
  });
  if (!created.ok) {
    throw new Error(`Failed to create QuickBooks customer (${created.status})`);
  }
  return created.data.Customer.Id;
}

/** MowGo doesn't sync a product catalog to QBO — reuse whatever Item the
 * company already has configured rather than guessing at an Income account. */
async function findAnyItem(env, tokenInfo) {
  const query = 'select * from Item where Active = true maxresults 1';
  const found = await qboRequest(env, tokenInfo, 'GET', `query?query=${encodeURIComponent(query)}`);
  const item = found.data?.QueryResponse?.Item?.[0];
  if (!item) {
    throw new Error('No active Item found in QuickBooks — add at least one product/service before syncing');
  }
  return item.Id;
}

async function readSyncMap(env, userId) {
  const supabaseUrl = getSupabaseUrl(env);
  const serviceKey = getSupabaseServiceKey(env);
  const res = await fetch(
    `${supabaseUrl}/rest/v1/integrations?user_id=eq.${encodeURIComponent(userId)}&provider=eq.quickbooks&select=id,metadata`,
    { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` }, signal: AbortSignal.timeout(5_000) },
  );
  if (!res.ok) throw new Error(`Failed to load sync map (${res.status})`);
  const [row] = await res.json();
  return { integrationId: row?.id, metadata: row?.metadata || {} };
}

async function writeSyncMapEntry(env, integrationId, metadata, invoiceId, qboInvoiceId) {
  const supabaseUrl = getSupabaseUrl(env);
  const serviceKey = getSupabaseServiceKey(env);
  const syncMap = { ...(metadata.syncMap || {}), [invoiceId]: qboInvoiceId };
  const nextMetadata = { ...metadata, syncMap };
  await fetch(`${supabaseUrl}/rest/v1/integrations?id=eq.${encodeURIComponent(integrationId)}`, {
    method: 'PATCH',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ metadata: nextMetadata, last_synced_at: new Date().toISOString() }),
    signal: AbortSignal.timeout(5_000),
  });
}

async function handleInvoiceCreated(env, userId, tokenInfo, payload) {
  const { invoiceId, customerName, customerEmail, amount, description, dueDate } = payload;
  if (!invoiceId || !customerName || typeof amount !== 'number') {
    return { status: 400, body: { synced: false, qboInvoiceId: null, error: 'invoiceId, customerName, and amount are required' } };
  }

  const customerId = await findOrCreateCustomer(env, tokenInfo, customerName, customerEmail);
  const itemId = await findAnyItem(env, tokenInfo);

  const created = await qboRequest(env, tokenInfo, 'POST', 'invoice', {
    CustomerRef: { value: customerId },
    DocNumber: String(invoiceId).slice(0, 21),
    ...(dueDate ? { DueDate: dueDate } : {}),
    Line: [
      {
        Amount: amount,
        DetailType: 'SalesItemLineDetail',
        Description: description || 'MowGo service',
        SalesItemLineDetail: { ItemRef: { value: itemId } },
      },
    ],
  });
  if (!created.ok) {
    return { status: 502, body: { synced: false, qboInvoiceId: null, error: `QuickBooks invoice create failed (${created.status})` } };
  }

  const qboInvoiceId = created.data.Invoice.Id;
  const { integrationId, metadata } = await readSyncMap(env, userId);
  await writeSyncMapEntry(env, integrationId, metadata, invoiceId, qboInvoiceId);
  return { status: 200, body: { synced: true, qboInvoiceId, error: null } };
}

async function handleInvoicePaid(env, userId, tokenInfo, payload) {
  const { invoiceId, amount } = payload;
  if (!invoiceId || typeof amount !== 'number') {
    return { status: 400, body: { synced: false, qboInvoiceId: null, error: 'invoiceId and amount are required' } };
  }

  const { metadata } = await readSyncMap(env, userId);
  const qboInvoiceId = metadata.syncMap?.[invoiceId];
  if (!qboInvoiceId) {
    return { status: 409, body: { synced: false, qboInvoiceId: null, error: 'Invoice was not previously synced to QuickBooks' } };
  }

  const invoiceRes = await qboRequest(env, tokenInfo, 'GET', `invoice/${qboInvoiceId}`);
  if (!invoiceRes.ok) {
    return { status: 502, body: { synced: false, qboInvoiceId, error: `Could not load QuickBooks invoice (${invoiceRes.status})` } };
  }
  const customerRef = invoiceRes.data.Invoice.CustomerRef;

  const payment = await qboRequest(env, tokenInfo, 'POST', 'payment', {
    CustomerRef: customerRef,
    TotalAmt: amount,
    Line: [{ Amount: amount, LinkedTxn: [{ TxnId: qboInvoiceId, TxnType: 'Invoice' }] }],
  });
  if (!payment.ok) {
    return { status: 502, body: { synced: false, qboInvoiceId, error: `QuickBooks payment create failed (${payment.status})` } };
  }

  const { integrationId, metadata: freshMetadata } = await readSyncMap(env, userId);
  await writeSyncMapEntry(env, integrationId, freshMetadata, invoiceId, qboInvoiceId);
  return { status: 200, body: { synced: true, qboInvoiceId, error: null } };
}

async function handleInvoiceDeleted(env, userId, tokenInfo, payload) {
  const { invoiceId } = payload;
  if (!invoiceId) {
    return { status: 400, body: { synced: false, qboInvoiceId: null, error: 'invoiceId is required' } };
  }

  const { metadata } = await readSyncMap(env, userId);
  const qboInvoiceId = metadata.syncMap?.[invoiceId];
  if (!qboInvoiceId) {
    // Never synced — nothing to void, treat as success.
    return { status: 200, body: { synced: true, qboInvoiceId: null, error: null } };
  }

  const invoiceRes = await qboRequest(env, tokenInfo, 'GET', `invoice/${qboInvoiceId}`);
  if (!invoiceRes.ok) {
    return { status: 502, body: { synced: false, qboInvoiceId, error: `Could not load QuickBooks invoice (${invoiceRes.status})` } };
  }
  const syncToken = invoiceRes.data.Invoice.SyncToken;

  const voided = await qboRequest(env, tokenInfo, 'POST', 'invoice?operation=void', {
    Id: qboInvoiceId,
    SyncToken: syncToken,
  });
  if (!voided.ok) {
    return { status: 502, body: { synced: false, qboInvoiceId, error: `QuickBooks invoice void failed (${voided.status})` } };
  }
  return { status: 200, body: { synced: true, qboInvoiceId, error: null } };
}

const HANDLERS = {
  'invoice.created': handleInvoiceCreated,
  'invoice.paid': handleInvoicePaid,
  'invoice.deleted': handleInvoiceDeleted,
};

export async function onRequestPost({ request, env }) {
  const headers = corsHeaders(request);

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400, headers });
  }
  const { event, payload = {} } = body;
  const handler = HANDLERS[event];
  if (!handler) {
    return Response.json({ error: `Unsupported event: ${event}` }, { status: 400, headers });
  }

  const authHeader = request.headers.get('Authorization');
  const token = authHeader?.replace('Bearer ', '');
  if (!token) {
    return Response.json({ error: 'Authentication required' }, { status: 401, headers });
  }

  let userId;
  try {
    userId = await verifyToken(token, env);
  } catch {
    return Response.json({ error: 'Invalid token' }, { status: 401, headers });
  }
  if (!userId) {
    return Response.json({ error: 'Invalid token' }, { status: 401, headers });
  }

  if (isRateLimited(userId, request)) {
    return Response.json({ error: 'Too many sync requests. Please try again later.' }, { status: 429, headers });
  }

  let tokenInfo;
  try {
    tokenInfo = await getValidAccessToken(env, userId);
  } catch (err) {
    console.error('qbo-sync: token lookup/refresh failed', err?.message || err);
    return Response.json({ synced: false, qboInvoiceId: null, error: 'Failed to load QuickBooks credentials' }, { status: 500, headers });
  }
  if (!tokenInfo) {
    return Response.json({ synced: false, qboInvoiceId: null, error: 'QuickBooks is not connected' }, { status: 409, headers });
  }

  try {
    const result = await handler(env, userId, tokenInfo, payload);
    return Response.json(result.body, { status: result.status, headers });
  } catch (err) {
    console.error('qbo-sync: handler threw', err?.message || err);
    return Response.json({ synced: false, qboInvoiceId: null, error: err?.message || 'Sync failed' }, { status: 500, headers });
  }
}

export async function onRequestOptions({ request }) {
  return new Response(null, {
    status: 204,
    headers: {
      ...corsHeaders(request),
      'Access-Control-Max-Age': '86400',
    },
  });
}
