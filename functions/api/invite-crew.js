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

export async function onRequestPost({ request, env }) {
  const origin = request.headers.get('origin');
  const corsHeaders = {
    'Access-Control-Allow-Origin': origin || '*',
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

    // Get owner's profile to verify they're an owner
    const ownerProfileRes = await fetch(
      `${supabaseUrl}/rest/v1/profiles?id=eq.${ownerId}&role=eq.owner&select=id,business_name`,
      { headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}` } }
    );
    const ownerProfiles = await ownerProfileRes.json();
    if (!ownerProfiles?.length || ownerProfiles[0].role !== 'owner') {
      return Response.json({ error: 'Only account owners can invite crew' }, { status: 403, headers: corsHeaders });
    }
    const ownerProfile = ownerProfiles[0];

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
        `${supabaseUrl}/rest/v1/profiles?id=eq.${invitedUserId}&select=id,business_id`,
        { headers: { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}` } }
      );
      const existingProfiles = await existingProfileRes.json();

      if (existingProfiles?.length > 0) {
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
          return Response.json({ error: `Failed to update profile: ${err}` }, { status: 500, headers: corsHeaders });
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
          return Response.json({ error: `Failed to create profile: ${err}` }, { status: 500, headers: corsHeaders });
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
        return Response.json({ error: `Failed to create user: ${err}` }, { status: 500, headers: corsHeaders });
      }

      const newUser = await createUserRes.json();
      invitedUserId = newUser.id;

      // Create profile for new user
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
        return Response.json({ error: `Created user but failed profile: ${err}` }, { status: 500, headers: corsHeaders });
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
          const { properties } = await linkRes.json();
          const resetUrl = properties?.action_link || '';
          if (resetUrl) {
            await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${env.RESEND_API_KEY}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                from: 'MowGo <invoices@mowgo.app>',
                to: [email],
                subject: "You've been added to a MowGo crew — set your password",
                html: `<p>${ownerProfile.business_name || 'Your crew lead'} added you to their MowGo crew.</p><p><a href="${resetUrl}">Set your password here</a> — it takes 30 seconds.</p><p>Once set, log in at <a href="https://mowgo.pages.dev">mowgo.pages.dev</a>.</p>`
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
    return Response.json({ error: `Server error: ${err.message}` }, { status: 500, headers: corsHeaders });
  }
}

export async function onRequestOptions({ request }) {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': request.headers.get('origin') || '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    }
  });
}
