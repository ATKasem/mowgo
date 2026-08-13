/**
 * Cloudflare Pages Function — Invite Crew Member
 *
 * POST /api/invite-crew
 * Body: { email: string }
 * Headers: Authorization: Bearer <owner-supabase-token>
 *
 * Handles two flows:
 *   1. NEW USER: Creates user in Supabase Auth → inserts profile
 *   2. EXISTING USER: Updates their profile's business_id to join the crew
 *
 * Env vars (set in Cloudflare dashboard):
 *   SUPABASE_URL — https://xxx.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY — service_role key (never exposed to client)
 */

const ALLOWED_ORIGINS = ['https://mowgoapp.com'];
const RATE_LIMIT_WINDOW = 15 * 60 * 1000;
const RATE_LIMIT_MAX = 10;
const inviteAttempts = new Map();

function corsOrigin(request) {
  const origin = request?.headers?.get?.('origin');
  return origin && ALLOWED_ORIGINS.includes(origin) ? origin : 'https://mowgoapp.com';
}

function checkRateLimit(key) {
  const now = Date.now();
  const entry = inviteAttempts.get(key);
  if (!entry || now >= entry.resetTime) {
    inviteAttempts.set(key, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count += 1;
  return true;
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

export async function onRequestPost({ request, env }) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': corsOrigin(request),
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  // Parse request
  let body;
  try { body = await request.json(); } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400, headers: corsHeaders });
  }
  const { email } = body;
  if (!email) {
    return Response.json({ error: 'Email required' }, { status: 400, headers: corsHeaders });
  }

  // Auth — owner must be authenticated
  const authHeader = request.headers.get('Authorization');
  const ownerToken = authHeader?.replace('Bearer ', '');
  if (!ownerToken) {
    return Response.json({ error: 'Authentication required' }, { status: 401, headers: corsHeaders });
  }

  const supabaseUrl = env.SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return Response.json({ error: 'Server misconfigured' }, { status: 500, headers: corsHeaders });
  }

  try {
    // Step 1: Verify owner identity from their token
    const ownerRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { 'Authorization': `Bearer ${ownerToken}`, 'apikey': env.SUPABASE_ANON_KEY || serviceKey }
    });
    if (!ownerRes.ok) {
      return Response.json({ error: 'Invalid owner token' }, { status: 401, headers: corsHeaders });
    }
    const { id: ownerId } = await ownerRes.json();

    const ip = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || 'unknown';
    if (!checkRateLimit(`owner:${ownerId}`) || !checkRateLimit(`ip:${ip}`)) {
      return Response.json({ error: 'Too many invitations. Please try again later.' }, { status: 429, headers: corsHeaders });
    }

    // Get owner's profile to verify they're an owner
    const ownerProfileRes = await fetch(
      `${supabaseUrl}/rest/v1/profiles?id=eq.${ownerId}&role=eq.owner&select=id,business_name,role,tier`,
      { headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}` } }
    );
    const ownerProfiles = await ownerProfileRes.json();
    if (!ownerProfiles?.length || ownerProfiles[0].role !== 'owner') {
      return Response.json({ error: 'Only account owners can invite crew' }, { status: 403, headers: corsHeaders });
    }
    const ownerProfile = ownerProfiles[0];
    if (!['crew', 'premium'].includes(ownerProfile.tier)) {
      return Response.json({ error: 'Crew invitations require a Crew or Premium plan' }, { status: 403, headers: corsHeaders });
    }

    // Step 2: Check if user already exists in auth.users
    const listRes = await fetch(
      `${supabaseUrl}/auth/v1/admin/users?filter=email%3Deq%3A${encodeURIComponent(email)}`,
      { headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}` } }
    );
    const { users } = await listRes.json();

    let invitedUserId;

    if (users?.length > 0) {
      // — FLOW 2: User already exists —
      invitedUserId = users[0].id;

      // Check if they already have a profile
      const existingProfileRes = await fetch(
        `${supabaseUrl}/rest/v1/profiles?id=eq.${invitedUserId}&select=id,business_id,role`,
        { headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}` } }
      );
      const existingProfiles = await existingProfileRes.json();

      if (existingProfiles?.length > 0) {
        const existingProfile = existingProfiles[0];
        if (existingProfile.business_id != null) {
          return Response.json({ error: 'This user already belongs to a business' }, { status: 409, headers: corsHeaders });
        }
        // Default role is 'owner' for every account, so role alone can't tell a
        // fresh signup from an active business owner. An owner who has created
        // clients/jobs/invoices is running their own business — converting them
        // into someone else's crew would lock them out of their data (account
        // takeover). Only users with NO business data may join another crew.
        const ownedData = await fetch(
          `${supabaseUrl}/rest/v1/clients?select=id&user_id=eq.${invitedUserId}&limit=1`,
          { headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}` } }
        );
        const ownedJobs = await fetch(
          `${supabaseUrl}/rest/v1/jobs?select=id&user_id=eq.${invitedUserId}&limit=1`,
          { headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}` } }
        );
        const [clients, jobs] = await Promise.all([ownedData, ownedJobs]).then(([c, j]) =>
          Promise.all([c.json(), j.json()])
        );
        if ((Array.isArray(clients) && clients.length > 0) || (Array.isArray(jobs) && jobs.length > 0)) {
          return Response.json({ error: 'This user is already running their own business' }, { status: 409, headers: corsHeaders });
        }
        // Update their business_id to join this owner's crew
        const updateRes = await fetch(
          `${supabaseUrl}/rest/v1/profiles?id=eq.${invitedUserId}`,
          {
            method: 'PATCH',
            headers: {
              'apikey': serviceKey,
              'Authorization': `Bearer ${serviceKey}`,
              'Content-Type': 'application/json',
              'Prefer': 'return=representation'
            },
            body: JSON.stringify({
              business_id: ownerId,
              role: 'crew',
              tier: 'crew'
            })
          }
        );
        if (!updateRes.ok) {
          const err = await updateRes.text();
          return Response.json({ error: 'Failed to update profile' }, { status: 500, headers: corsHeaders });
        }
        const [updated] = await updateRes.json();
        return Response.json({
          invited: email,
          flow: 'existing_user',
          profile: updated
        }, { status: 200, headers: corsHeaders });
      } else {
        // User exists in auth but has no profile — create one
        const insertRes = await fetch(
          `${supabaseUrl}/rest/v1/profiles`,
          {
            method: 'POST',
            headers: {
              'apikey': serviceKey,
              'Authorization': `Bearer ${serviceKey}`,
              'Content-Type': 'application/json',
              'Prefer': 'return=representation'
            },
            body: JSON.stringify({
              id: invitedUserId,
              business_name: email.split('@')[0],
              tier: 'crew',
              role: 'crew',
              business_id: ownerId
            })
          }
        );
        if (!insertRes.ok) {
          const err = await insertRes.text();
          return Response.json({ error: 'Failed to create profile' }, { status: 500, headers: corsHeaders });
        }
        const [created] = await insertRes.json();
        return Response.json({
          invited: email,
          flow: 'existing_user_new_profile',
          profile: created
        }, { status: 200, headers: corsHeaders });
      }
    } else {
      // — FLOW 1: New user — create via Admin API
      const createUserRes = await fetch(
        `${supabaseUrl}/auth/v1/admin/users`,
        {
          method: 'POST',
          headers: {
            'apikey': serviceKey,
            'Authorization': `Bearer ${serviceKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            email,
            email_confirm: true,
            user_metadata: {
              business_name: email.split('@')[0],
              invited_by: ownerProfile.business_name || ownerId
            }
          })
        }
      );

      if (!createUserRes.ok) {
        const err = await createUserRes.text();
        return Response.json({ error: 'Failed to create user' }, { status: 500, headers: corsHeaders });
      }

      const newUser = await createUserRes.json();
      invitedUserId = newUser.id;

      // The on_auth_user_created trigger already created a profile row for
      // invitedUserId — update it instead of inserting (would conflict on PK).
      const insertRes = await fetch(
        `${supabaseUrl}/rest/v1/profiles?id=eq.${invitedUserId}`,
        {
          method: 'PATCH',
          headers: {
            'apikey': serviceKey,
            'Authorization': `Bearer ${serviceKey}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
          },
          body: JSON.stringify({
            business_name: email.split('@')[0],
            tier: 'crew',
            role: 'crew',
            business_id: ownerId
          })
        }
      );

      if (!insertRes.ok) {
        const err = await insertRes.text();
        return Response.json({ error: 'Account created but profile setup failed' }, { status: 500, headers: corsHeaders });
      }

      const [profile] = await insertRes.json();

      // New users can't log in without a password — send a set-password link.
      // If the email fails, the invite still succeeds (they can use forgot-password).
      try {
        const linkRes = await fetch(`${supabaseUrl}/auth/v1/admin/generate_link`, {
          method: 'POST',
          headers: {
            'apikey': serviceKey,
            'Authorization': `Bearer ${serviceKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ type: 'recovery', email })
        });
        if (linkRes.ok && env.RESEND_API_KEY) {
          const { action_link: resetUrl } = await linkRes.json();
          if (resetUrl) {
            await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${env.RESEND_API_KEY}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                from: 'MowGo <invoices@mowgoapp.com>',
                to: [email],
                subject: "You've been added to a MowGo crew — set your password",
                html: `<p>${escapeHtml(ownerProfile.business_name || 'Your crew lead')} added you to their MowGo crew.</p><p><a href="${resetUrl}">Set your password here</a> — it takes 30 seconds.</p><p>Once set, log in at <a href="https://mowgoapp.com">mowgoapp.com</a>.</p>`
              })
            });
          }
        }
      } catch (e) {
        // invite still succeeds; user can use forgot-password
      }

      return Response.json({
        invited: email,
        flow: 'new_user',
        profile
      }, { status: 201, headers: corsHeaders });
    }
  } catch (err) {
    return Response.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders });
  }
}

export async function onRequestOptions({ request }) {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': corsOrigin(request),
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    }
  });
}
