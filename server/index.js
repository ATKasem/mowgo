require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const Stripe = require('stripe');
const { Resend } = require('resend');

const app = express();

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, cb) {
    // Allow same-origin/non-browser callers (no Origin header) through to auth.
    // Disallowed origins get `false` rather than an Error: omitting the CORS
    // headers is what actually blocks the browser, whereas throwing turns a
    // rejected preflight into a 500 from the default error handler.
    cb(null, !origin || ALLOWED_ORIGINS.includes(origin));
  },
}));

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const resend = new Resend(process.env.RESEND_API_KEY);

// === Stripe webhook ===
// Must be registered BEFORE express.json(), otherwise the body is parsed and
// constructEvent never sees the raw bytes it needs to verify the signature.
app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;
  try { event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET); }
  catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send('Webhook Error');
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const { invoice_id, user_id } = session.metadata || {};
    if (invoice_id && user_id) {
      // Scope by user_id as well — metadata is ours, but the update should not
      // be able to reach another tenant's row even if it were tampered with.
      const { error } = await supabase.from('invoices')
        .update({
          status: 'paid',
          paid_at: new Date().toISOString(),
          stripe_payment_intent_id: session.payment_intent,
        })
        .eq('id', invoice_id)
        .eq('user_id', user_id);
      if (error) console.error('Webhook invoice update failed:', error.message);
    } else {
      console.error('Webhook missing invoice metadata');
    }
  }
  res.json({ received: true });
});

app.use(express.json());

// === Helpers ===

/** Copy only the named fields — never spread req.body into a write. */
function pick(source, fields) {
  const out = {};
  for (const f of fields) {
    if (source[f] !== undefined) out[f] = source[f];
  }
  return out;
}

const CLIENT_FIELDS = [
  'name', 'address', 'phone', 'email', 'rate',
  'cleaning_notes', 'key_code', 'alarm_code', 'pet_instructions',
];

const JOB_FIELDS = [
  'client_id', 'assigned_to', 'title', 'scheduled_date', 'scheduled_time',
  'duration_minutes', 'status', 'notes', 'photo_url', 'route_order',
  'is_recurring', 'recurrence_rule',
];

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Log the real error, return a generic one. */
function fail(res, context, error, status = 500) {
  console.error(`${context}:`, error?.message || error);
  return res.status(status).json({ error: 'Request failed' });
}

/** Confirm a client row belongs to this user before referencing it. */
async function ownsClient(userId, clientId) {
  const { data, error } = await supabase
    .from('clients').select('id, name, email').eq('id', clientId).eq('user_id', userId).maybeSingle();
  if (error || !data) return null;
  return data;
}

// Auth middleware — verify Supabase JWT
async function auth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No token' });
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return res.status(401).json({ error: 'Invalid token' });
  req.user = user;
  next();
}

// === CLIENTS ===
app.get('/api/clients', auth, async (req, res) => {
  const { data, error } = await supabase.from('clients').select('*').eq('user_id', req.user.id).order('name');
  if (error) return fail(res, 'GET /api/clients', error);
  res.json(data);
});

app.post('/api/clients', auth, async (req, res) => {
  const { data, error } = await supabase.from('clients')
    .insert({ ...pick(req.body, CLIENT_FIELDS), user_id: req.user.id })
    .select().single();
  if (error) return fail(res, 'POST /api/clients', error);
  res.json(data);
});

app.put('/api/clients/:id', auth, async (req, res) => {
  const updates = pick(req.body, CLIENT_FIELDS);
  if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'No valid fields to update' });
  const { data, error } = await supabase.from('clients')
    .update(updates).eq('id', req.params.id).eq('user_id', req.user.id).select().maybeSingle();
  if (error) return fail(res, 'PUT /api/clients/:id', error);
  if (!data) return res.status(404).json({ error: 'Not found' });
  res.json(data);
});

app.delete('/api/clients/:id', auth, async (req, res) => {
  const { error } = await supabase.from('clients').delete().eq('id', req.params.id).eq('user_id', req.user.id);
  if (error) return fail(res, 'DELETE /api/clients/:id', error);
  res.json({ success: true });
});

// === JOBS ===
app.get('/api/jobs', auth, async (req, res) => {
  let query = supabase.from('jobs').select('*, clients(name, address, phone)').eq('user_id', req.user.id);
  if (req.query.date) query = query.eq('scheduled_date', req.query.date);
  if (req.query.status) query = query.eq('status', req.query.status);
  const { data, error } = await query.order('scheduled_time');
  if (error) return fail(res, 'GET /api/jobs', error);
  res.json(data);
});

app.get('/api/jobs/today', auth, async (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const { data, error } = await supabase.from('jobs').select('*, clients(name, address, phone)').eq('user_id', req.user.id).eq('scheduled_date', today).order('route_order', { ascending: true, nullsLast: true });
  if (error) return fail(res, 'GET /api/jobs/today', error);
  res.json(data);
});

app.post('/api/jobs', auth, async (req, res) => {
  const job = pick(req.body, JOB_FIELDS);
  if (job.client_id && !(await ownsClient(req.user.id, job.client_id))) {
    return res.status(400).json({ error: 'Unknown client' });
  }
  const { data, error } = await supabase.from('jobs')
    .insert({ ...job, user_id: req.user.id })
    .select().single();
  if (error) return fail(res, 'POST /api/jobs', error);
  res.json(data);
});

app.put('/api/jobs/:id', auth, async (req, res) => {
  const updates = pick(req.body, JOB_FIELDS);
  if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'No valid fields to update' });
  if (updates.client_id && !(await ownsClient(req.user.id, updates.client_id))) {
    return res.status(400).json({ error: 'Unknown client' });
  }
  const { data, error } = await supabase.from('jobs')
    .update(updates).eq('id', req.params.id).eq('user_id', req.user.id).select().maybeSingle();
  if (error) return fail(res, 'PUT /api/jobs/:id', error);
  if (!data) return res.status(404).json({ error: 'Not found' });
  res.json(data);
});

app.delete('/api/jobs/:id', auth, async (req, res) => {
  const { error } = await supabase.from('jobs').delete().eq('id', req.params.id).eq('user_id', req.user.id);
  if (error) return fail(res, 'DELETE /api/jobs/:id', error);
  res.json({ success: true });
});

app.post('/api/jobs/reorder', auth, async (req, res) => {
  const { orders } = req.body; // [{ id, route_order }]
  if (!Array.isArray(orders)) return res.status(400).json({ error: 'orders must be an array' });

  const valid = orders.filter(o => o && typeof o.id === 'string' && Number.isInteger(o.route_order));
  if (valid.length !== orders.length) return res.status(400).json({ error: 'Invalid order entry' });

  const results = await Promise.all(valid.map(({ id, route_order }) =>
    supabase.from('jobs').update({ route_order }).eq('id', id).eq('user_id', req.user.id)
  ));
  const failed = results.find(r => r.error);
  if (failed) return fail(res, 'POST /api/jobs/reorder', failed.error);

  res.json({ success: true });
});

// === INVOICES ===
app.get('/api/invoices', auth, async (req, res) => {
  const { data, error } = await supabase.from('invoices').select('*, clients(name), jobs(scheduled_date)').eq('user_id', req.user.id).order('created_at', { ascending: false });
  if (error) return fail(res, 'GET /api/invoices', error);
  res.json(data);
});

app.post('/api/invoices', auth, async (req, res) => {
  const { client_id, job_id, amount } = req.body;

  const parsedAmount = Number(amount);
  if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
    return res.status(400).json({ error: 'Invalid amount' });
  }

  // The client must belong to the caller — this runs on the service key, so RLS
  // will not catch a client_id borrowed from another account.
  const client = await ownsClient(req.user.id, client_id);
  if (!client) return res.status(400).json({ error: 'Unknown client' });

  // Same for the optional job reference.
  if (job_id) {
    const { data: job } = await supabase
      .from('jobs').select('id').eq('id', job_id).eq('user_id', req.user.id).maybeSingle();
    if (!job) return res.status(400).json({ error: 'Unknown job' });
  }

  const { data: invoice, error } = await supabase.from('invoices')
    .insert({ user_id: req.user.id, client_id, job_id, amount: parsedAmount, status: 'unpaid' })
    .select().single();
  if (error) return fail(res, 'POST /api/invoices', error);

  if (client.email) {
    const payUrl = `${process.env.APP_URL}/pay/${invoice.id}`;
    try {
      await resend.emails.send({
        from: 'MowFlow <invoices@mowflow.app>',
        to: client.email,
        subject: `Invoice from MowFlow — $${parsedAmount}`,
        html: `<p>Hi ${escapeHtml(client.name)},</p><p>Here's your lawn care invoice for $${escapeHtml(parsedAmount)}. <a href="${escapeHtml(payUrl)}">Pay online</a></p>`,
      });
    } catch (err) {
      // The invoice exists; a failed email should not fail the request.
      console.error('Invoice email failed:', err?.message || err);
    }
  }

  res.json(invoice);
});

// === STRIPE ===
app.post('/api/stripe/checkout', auth, async (req, res) => {
  const { invoice_id } = req.body;
  if (!invoice_id) return res.status(400).json({ error: 'invoice_id is required' });

  // Amount comes from the invoice row, never from the request body.
  const { data: invoice, error } = await supabase
    .from('invoices').select('id, amount, status').eq('id', invoice_id).eq('user_id', req.user.id).maybeSingle();
  if (error) return fail(res, 'POST /api/stripe/checkout', error);
  if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
  if (invoice.status === 'paid') return res.status(409).json({ error: 'Invoice already paid' });

  const unitAmount = Math.round(Number(invoice.amount) * 100);
  if (!Number.isFinite(unitAmount) || unitAmount <= 0) {
    return res.status(400).json({ error: 'Invoice amount is invalid' });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{ price_data: { currency: 'usd', product_data: { name: 'Service Invoice' }, unit_amount: unitAmount }, quantity: 1 }],
      mode: 'payment',
      success_url: `${process.env.APP_URL}/invoices?paid=true`,
      cancel_url: `${process.env.APP_URL}/invoices?paid=false`,
      metadata: { invoice_id: invoice.id, user_id: req.user.id },
    });
    res.json({ url: session.url });
  } catch (err) {
    return fail(res, 'Stripe checkout', err);
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`MowFlow API running on port ${PORT}`));
