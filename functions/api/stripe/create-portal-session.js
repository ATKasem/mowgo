/**
 * Cloudflare Pages Function — Stripe Customer Portal
 * POST /api/stripe/create-portal-session
 */

const ALLOWED_ORIGINS = ['https://mowgo.pages.dev', 'https://mowgo.app'];

export async function onRequestPost({ request, env }) {
  const origin = request.headers.get('origin');
  if (!origin || !ALLOWED_ORIGINS.includes(origin)) return json({ error: 'Forbidden' }, 403);

  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'Unauthorized' }, 401, origin);

  const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  const supabaseAnonKey = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY;
  const supabaseServiceKey = env.SUPABASE_SERVICE_KEY;
  if (!env.STRIPE_SECRET_KEY || !supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
    return json({ error: 'Billing portal not configured' }, 500, origin);
  }

  try {
    const authResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: supabaseAnonKey },
    });
    if (!authResponse.ok) return json({ error: 'Unauthorized' }, 401, origin);
    const user = await authResponse.json();

    const profileResponse = await fetch(
      `${supabaseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=stripe_customer_id`,
      {
        headers: {
          Authorization: `Bearer ${supabaseServiceKey}`,
          apikey: supabaseServiceKey,
        },
      },
    );
    if (!profileResponse.ok) throw new Error('Could not load billing profile');
    const [profile] = await profileResponse.json();
    if (!profile?.stripe_customer_id) {
      return json({ error: 'No subscription found' }, 400, origin);
    }

    const portalResponse = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        customer: profile.stripe_customer_id,
        return_url: `${env.APP_URL || origin}/#/settings`,
      }).toString(),
    });
    const portal = await portalResponse.json();
    if (!portalResponse.ok || portal.error) {
      console.error('Stripe portal error:', portal.error?.type, portal.error?.message);
      return json({ error: 'Unable to open subscription management' }, 502, origin);
    }
    return json({ url: portal.url }, 200, origin);
  } catch (err) {
    console.error('Portal function error:', err);
    return json({ error: 'Something went wrong' }, 500, origin);
  }
}

function json(data, status = 200, origin = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (origin && ALLOWED_ORIGINS.includes(origin)) headers['Access-Control-Allow-Origin'] = origin;
  return new Response(JSON.stringify(data), { status, headers });
}
