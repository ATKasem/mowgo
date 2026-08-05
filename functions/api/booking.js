/**
 * Cloudflare Pages Function — Public Booking (customer self-scheduling)
 *
 * POST /api/booking
 * Body: { business_id, customer_name, customer_phone, customer_address, notes, scheduled_date, scheduled_time }
 *
 * Creates a job in Supabase jobs table + creates/updates the client record.
 * Bypasses RLS using service-role key. Rate-limits by IP (5 bookings / 15 min).
 *
 * Env vars (set in Cloudflare dashboard):
 *   SUPABASE_URL          — Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY — Supabase service role key (for bypassing RLS)
 */

// NOTE: In-memory rate limiting is best-effort on Cloudflare (per-isolate).
// For production, enable Cloudflare Rate Limiting rules in the dashboard
// (5 req / 15 min per IP on /api/booking) — that is the real defense.
const RATE_LIMIT_WINDOW = 15 * 60 * 1000;
const RATE_LIMIT_MAX = 5;
const rateLimitMap = new Map();
const ALLOWED_ORIGINS = ['https://mowgo.pages.dev', 'https://mowgoapp.com'];

function corsOrigin(request) {
  const origin = request?.headers?.get?.('origin');
  return origin && ALLOWED_ORIGINS.includes(origin) ? origin : 'https://mowgo.pages.dev';
}

function checkRateLimit(ip) {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count++;
  return true;
}

const ALLOWED_TIME_SLOTS = new Set([
  '08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  '12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30',
  '16:00', '16:30', '17:00',
]);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidBookingDate(dateStr) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const d = new Date(`${dateStr}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const max = new Date(today);
  max.setDate(max.getDate() + 14); // allow up to 14 days out
  return d >= today && d <= max;
}

export async function onRequestOptions(context) {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': corsOrigin(context.request),
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const origin = corsOrigin(request);
  const json = (data, status = 200) => jsonHelper(data, status, origin);

  // Rate limit
  const ip = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || 'unknown';
  if (!checkRateLimit(ip)) {
    return json({ error: 'Too many booking requests. Please try again later.' }, 429);
  }

  // Validate env
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    console.warn('Booking function: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set');
    return json({ error: 'Booking is not configured. Please contact the business.' }, 503);
  }

  try {
    const body = await request.json();
    const { business_id, customer_name, customer_phone, customer_address, notes, scheduled_date, scheduled_time } = body;

    // Validate required fields
    if (!business_id || !customer_name || !customer_phone || !customer_address || !scheduled_date || !scheduled_time) {
      return json({ error: 'Missing required fields: name, phone, address, date, and time are required.' }, 400);
    }

    // Validate business_id is a real UUID (prevents query injection)
    if (!UUID_RE.test(business_id)) {
      return json({ error: 'Invalid booking link.' }, 400);
    }

    // Validate date format
    if (!isValidBookingDate(scheduled_date)) {
      return json({ error: 'Invalid date. Bookings must be within the next 14 days.' }, 400);
    }

    // Validate time format
    if (!ALLOWED_TIME_SLOTS.has(scheduled_time)) {
      return json({ error: 'Invalid time slot.' }, 400);
    }

    // Validate name length
    if (customer_name.trim().length < 2 || customer_name.trim().length > 100) {
      return json({ error: 'Name must be 2-100 characters.' }, 400);
    }

    // Validate phone length
    if (customer_phone.trim().length < 5 || customer_phone.trim().length > 20) {
      return json({ error: 'Phone number must be 5-20 characters.' }, 400);
    }
    if (!/^[+\d\s\-().]{5,20}$/.test(customer_phone.trim())) {
      return json({ error: 'Phone number contains invalid characters.' }, 400);
    }

    // Validate address/notes length
    if (customer_address.trim().length > 200) {
      return json({ error: 'Address is too long.' }, 400);
    }
    if ((notes || '').trim().length > 500) {
      return json({ error: 'Notes are too long.' }, 400);
    }

    const supabaseUrl = env.SUPABASE_URL;
    const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
    const headers = {
      'apikey': serviceKey,
      'Authorization': `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
    };

    // 1. Check if business exists
    const profileRes = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${business_id}&select=id,business_name`, { headers });
    const profiles = await profileRes.json();
    if (!profiles || profiles.length === 0) {
      return json({ error: 'Business not found.' }, 404);
    }

    // 2. Check for duplicate booking (same business + date + time)
    const dupRes = await fetch(
      `${supabaseUrl}/rest/v1/jobs?user_id=eq.${business_id}&scheduled_date=eq.${scheduled_date}&scheduled_time=eq.${scheduled_time}&status=eq.scheduled&select=id`,
      { headers }
    );
    const dups = await dupRes.json();
    if (dups && dups.length > 0) {
      return json({ error: 'This time slot is already booked. Please choose another.' }, 409);
    }

    // 3. Find or create client record
    let clientId = null;
    const clientRes = await fetch(
      `${supabaseUrl}/rest/v1/clients?user_id=eq.${business_id}&phone=eq.${encodeURIComponent(customer_phone.trim())}&select=id`,
      { headers }
    );
    const clients = await clientRes.json();
    if (clients && clients.length > 0) {
      clientId = clients[0].id;
    } else {
      // Create new client
      const newClientRes = await fetch(`${supabaseUrl}/rest/v1/clients`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          user_id: business_id,
          name: customer_name.trim(),
          phone: customer_phone.trim(),
          address: customer_address.trim(),
          rate: 0,
        }),
      });
      const newClients = await newClientRes.json();
      if (newClientRes.ok && newClients?.length > 0) {
        clientId = newClients[0].id;
      }
    }

    // 4. Create the job
    const jobRes = await fetch(`${supabaseUrl}/rest/v1/jobs`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        user_id: business_id,
        client_id: clientId,
        title: `Online Booking — ${customer_name.trim()}`,
        scheduled_date,
        scheduled_time,
        status: 'scheduled',
        duration_minutes: 60,
        route_order: 99,
        notes: notes?.trim() || null,
      }),
    });

    const jobs = await jobRes.json();
    if (!jobRes.ok) {
      console.error('Booking: job insert failed', jobs);
      return json({ error: 'Failed to create booking. Please try again.' }, 500);
    }

    return json({
      success: true,
      job_id: jobs?.[0]?.id,
      message: 'Booking confirmed!',
    }, 201);

  } catch (err) {
    console.error('Booking function error:', err);
    return json({ error: 'Something went wrong. Please try again.' }, 500);
  }
}

function jsonHelper(data, status = 200, origin = 'https://mowgo.pages.dev') {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': origin,
    },
  });
}
