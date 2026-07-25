require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { createClient } = require('@supabase/supabase-js');
const Stripe = require('stripe');
const { Resend } = require('resend');

const app = express();

// === Security middleware ===
app.use(helmet({
  contentSecurityPolicy: false, // Let Cloudflare handle CSP
  crossOriginEmbedderPolicy: false,
}));

// CORS — restrict to app origin
app.use(cors({
  origin: process.env.APP_URL || 'http://localhost:5173',
  credentials: true,
}));

// General rate limit: 100 requests per 15 minutes
app.use('/api/', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
}));

// Stripe endpoints: stricter limit
app.use('/api/stripe/', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
}));

// Webhook needs raw body for Stripe signature verification — mount BEFORE json parser
app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;
  try { event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET); }
  catch (err) { return res.status(400).send(`Webhook Error: ${err.message}`); }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const invoiceId = session.metadata.invoice_id;
    if (!invoiceId) return res.status(400).send('Missing invoice_id');

    // Verify payment amount matches invoice
    const { data: invoice } = await supabase
      .from('invoices')
      .select('amount')
      .eq('id', invoiceId)
      .single();

    if (!invoice) return res.status(404).send('Invoice not found');

    const paidAmount = (session.amount_total || 0) / 100;
    if (Math.abs(paidAmount - invoice.amount) > 0.01) {
      console.error(`Amount mismatch: invoice=${invoice.amount}, paid=${paidAmount}`);
      return res.status(400).send('Amount mismatch');
    }

    await supabase.from('invoices').update({
      status: 'paid',
      paid_at: new Date().toISOString(),
      stripe_payment_intent_id: session.payment_intent,
    }).eq('id', invoiceId);
  }
  res.json({ received: true });
});

app.use(express.json());

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const resend = new Resend(process.env.RESEND_API_KEY);

// === Helpers ===
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.post('/api/clients', auth, async (req, res) => {
  const { name, address, phone, email, rate, service_notes, key_code, alarm_code, pet_instructions } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Client name is required' });
  const { data, error } = await supabase.from('clients').insert({
    name: name.trim(),
    address: address || null,
    phone: phone || null,
    email: email || null,
    rate: Number(rate) || 0,
    cleaning_notes: service_notes || null,
    key_code: key_code || null,
    alarm_code: alarm_code || null,
    pet_instructions: pet_instructions || null,
    user_id: req.user.id,
  }).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.put('/api/clients/:id', auth, async (req, res) => {
  const { name, address, phone, email, rate, service_notes, key_code, alarm_code, pet_instructions } = req.body;
  const allowed = {};
  if (name !== undefined) allowed.name = name;
  if (address !== undefined) allowed.address = address;
  if (phone !== undefined) allowed.phone = phone;
  if (email !== undefined) allowed.email = email;
  if (rate !== undefined) allowed.rate = Number(rate) || 0;
  if (service_notes !== undefined) allowed.cleaning_notes = service_notes;
  if (key_code !== undefined) allowed.key_code = key_code;
  if (alarm_code !== undefined) allowed.alarm_code = alarm_code;
  if (pet_instructions !== undefined) allowed.pet_instructions = pet_instructions;

  const { data, error } = await supabase.from('clients').update(allowed).eq('id', req.params.id).eq('user_id', req.user.id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.delete('/api/clients/:id', auth, async (req, res) => {
  const { error } = await supabase.from('clients').delete().eq('id', req.params.id).eq('user_id', req.user.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// === JOBS ===
app.get('/api/jobs', auth, async (req, res) => {
  let query = supabase.from('jobs').select('*, clients(name, address, phone)').eq('user_id', req.user.id);
  if (req.query.date) query = query.eq('scheduled_date', req.query.date);
  if (req.query.status) query = query.eq('status', req.query.status);
  const { data, error } = await query.order('scheduled_time');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.get('/api/jobs/today', auth, async (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const { data, error } = await supabase.from('jobs').select('*, clients(name, address, phone)').eq('user_id', req.user.id).eq('scheduled_date', today).order('route_order', { ascending: true, nullsLast: true });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.post('/api/jobs', auth, async (req, res) => {
  const { title, client_id, scheduled_date, scheduled_time, duration_minutes, status, route_order, recurrence_rule, notes } = req.body;
  const { data, error } = await supabase.from('jobs').insert({
    title: title || null,
    client_id,
    scheduled_date,
    scheduled_time: scheduled_time || null,
    duration_minutes: duration_minutes || 60,
    status: status || 'scheduled',
    route_order: route_order || 99,
    recurrence_rule: recurrence_rule || 'none',
    notes: notes || null,
    user_id: req.user.id,
  }).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.put('/api/jobs/:id', auth, async (req, res) => {
  const allowed = {};
  const fields = ['title', 'client_id', 'scheduled_date', 'scheduled_time', 'duration_minutes', 'status', 'route_order', 'recurrence_rule', 'notes'];
  for (const f of fields) {
    if (req.body[f] !== undefined) allowed[f] = req.body[f];
  }
  if (Object.keys(allowed).length === 0) return res.status(400).json({ error: 'No valid fields to update' });

  const { data, error } = await supabase.from('jobs').update(allowed).eq('id', req.params.id).eq('user_id', req.user.id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.delete('/api/jobs/:id', auth, async (req, res) => {
  const { error } = await supabase.from('jobs').delete().eq('id', req.params.id).eq('user_id', req.user.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

app.post('/api/jobs/reorder', auth, async (req, res) => {
  const { orders } = req.body; // [{ id, route_order }]
  if (!Array.isArray(orders)) return res.status(400).json({ error: 'orders must be an array' });
  for (const { id, route_order } of orders) {
    await supabase.from('jobs').update({ route_order }).eq('id', id).eq('user_id', req.user.id);
  }
  res.json({ success: true });
});

// === INVOICES ===
app.get('/api/invoices', auth, async (req, res) => {
  const { data, error } = await supabase.from('invoices').select('*, clients(name), jobs(scheduled_date)').eq('user_id', req.user.id).order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.post('/api/invoices', auth, async (req, res) => {
  const { client_id, job_id, amount } = req.body;
  if (!client_id) return res.status(400).json({ error: 'Missing client_id' });
  if (!amount || amount <= 0) return res.status(400).json({ error: 'Invalid amount' });

  const { data: invoice, error } = await supabase.from('invoices').insert({ user_id: req.user.id, client_id, job_id, amount, status: 'unpaid' }).select().single();
  if (error) return res.status(500).json({ error: error.message });

  // Get client email
  const { data: client } = await supabase.from('clients').select('email, name').eq('id', client_id).single();

  // Send invoice via Resend — with HTML escaping to prevent injection
  if (client?.email) {
    await resend.emails.send({
      from: 'MowFlow <invoices@mowflow.app>',
      to: client.email,
      subject: `Invoice from MowFlow — $${amount}`,
      html: `<p>Hi ${escapeHtml(client.name)},</p><p>Here's your lawn care invoice for $${escapeHtml(String(amount))}. <a href="${process.env.APP_URL}/pay/${invoice.id}">Pay online</a></p>`,
    });
  }

  res.json(invoice);
});

// Send invoice email (used by autopilot which creates invoices via Supabase directly)
app.post('/api/invoices/send-email', auth, async (req, res) => {
  const { invoice_id, client_id, amount } = req.body;
  if (!invoice_id || !client_id) return res.status(400).json({ error: 'Missing invoice_id or client_id' });

  const { data: client } = await supabase.from('clients').select('email, name').eq('id', client_id).single();
  if (!client?.email) return res.json({ sent: false, reason: 'No email on file' });

  await resend.emails.send({
    from: 'MowFlow <invoices@mowflow.app>',
    to: client.email,
    subject: `Invoice from MowFlow — $${amount}`,
    html: `<p>Hi ${escapeHtml(client.name)},</p><p>Here's your lawn care invoice for $${escapeHtml(String(amount))}. <a href="${process.env.APP_URL}/pay/${invoice_id}">Pay online</a></p>`,
  });

  res.json({ sent: true });
});

// === STRIPE ===
app.post('/api/stripe/checkout', auth, async (req, res) => {
  const { invoice_id } = req.body;
  if (!invoice_id) return res.status(400).json({ error: 'Missing invoice_id' });

  // Fetch the invoice server-side — never trust client-provided amounts
  const { data: invoice, error: invError } = await supabase
    .from('invoices')
    .select('amount, status, user_id')
    .eq('id', invoice_id)
    .single();

  if (invError || !invoice) return res.status(404).json({ error: 'Invoice not found' });
  if (invoice.user_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
  if (invoice.status === 'paid') return res.status(400).json({ error: 'Invoice already paid' });

  const amountInCents = Math.round(invoice.amount * 100);
  if (amountInCents <= 0) return res.status(400).json({ error: 'Invalid invoice amount' });

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [{ price_data: { currency: 'usd', product_data: { name: 'Service Invoice' }, unit_amount: amountInCents }, quantity: 1 }],
    mode: 'payment',
    success_url: `${process.env.APP_URL}/invoices?paid=true`,
    cancel_url: `${process.env.APP_URL}/invoices?paid=false`,
    metadata: { invoice_id },
  });
  res.json({ url: session.url });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`MowFlow API running on port ${PORT}`));
