require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const Stripe = require('stripe');
const { Resend } = require('resend');

const app = express();
app.use(cors());
app.use(express.json());

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const resend = new Resend(process.env.RESEND_API_KEY);

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
  const { data, error } = await supabase.from('clients').insert({ ...req.body, user_id: req.user.id }).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.put('/api/clients/:id', auth, async (req, res) => {
  const { data, error } = await supabase.from('clients').update(req.body).eq('id', req.params.id).eq('user_id', req.user.id).select().single();
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
  const { data, error } = await supabase.from('jobs').insert({ ...req.body, user_id: req.user.id }).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.put('/api/jobs/:id', auth, async (req, res) => {
  const { data, error } = await supabase.from('jobs').update(req.body).eq('id', req.params.id).eq('user_id', req.user.id).select().single();
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
  const { data: invoice, error } = await supabase.from('invoices').insert({ user_id: req.user.id, client_id, job_id, amount, status: 'unpaid' }).select().single();
  if (error) return res.status(500).json({ error: error.message });

  // Get client email
  const { data: client } = await supabase.from('clients').select('email, name').eq('id', client_id).single();

  // Send invoice via Resend
  if (client?.email) {
    await resend.emails.send({
      from: 'MowFlow <invoices@mowflow.app>',
      to: client.email,
      subject: `Invoice from MowFlow — $${amount}`,
      html: `<p>Hi ${client.name},</p><p>Here's your lawn care invoice for $${amount}. <a href="${process.env.APP_URL}/pay/${invoice.id}">Pay online</a></p>`,
    });
  }

  res.json(invoice);
});

// === STRIPE ===
app.post('/api/stripe/checkout', auth, async (req, res) => {
  const { invoice_id, amount } = req.body;
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [{ price_data: { currency: 'usd', product_data: { name: 'Service Invoice' }, unit_amount: Math.round(amount * 100) }, quantity: 1 }],
    mode: 'payment',
    success_url: `${process.env.APP_URL}/invoices?paid=true`,
    cancel_url: `${process.env.APP_URL}/invoices?paid=false`,
    metadata: { invoice_id },
  });
  res.json({ url: session.url });
});

app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;
  try { event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET); }
  catch (err) { return res.status(400).send(`Webhook Error: ${err.message}`); }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    await supabase.from('invoices').update({ status: 'paid', paid_at: new Date().toISOString(), stripe_payment_intent_id: session.payment_intent }).eq('id', session.metadata.invoice_id);
  }
  res.json({ received: true });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`MowFlow API running on port ${PORT}`));
