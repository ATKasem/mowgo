/**
 * Cloudflare Pages Function — Remove Crew Member
 *
 * DELETE /api/team/:memberId
 * Headers: Authorization: Bearer <owner-supabase-token>
 *
 * Detaches a crew profile without deleting it, avoiding cascading deletion of
 * business data owned by that profile.
 */

const ALLOWED_ORIGINS = ['https://mowgoapp.com', 'https://mowgo.pages.dev'];

function corsHeaders(request) {
  const origin = request?.headers?.get?.('origin');
  return {
    'Access-Control-Allow-Origin': origin && ALLOWED_ORIGINS.includes(origin) ? origin : 'https://mowgoapp.com',
    'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

function jsonResponse(request, body, status) {
  return Response.json(body, { status, headers: corsHeaders(request) });
}

export async function onRequestDelete({ request, env, params }) {
  const routeMemberId = Array.isArray(params?.memberId) ? params.memberId[0] : params?.memberId;
  const pathMemberId = new URL(request.url).pathname.split('/').filter(Boolean).at(-1);
  const memberId = routeMemberId || (pathMemberId !== 'remove' ? pathMemberId : null);
  if (!memberId) return jsonResponse(request, { error: 'Member ID required' }, 400);

  const authHeader = request.headers.get('Authorization');
  const ownerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!ownerToken) return jsonResponse(request, { error: 'Authentication required' }, 401);

  const supabaseUrl = env.SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    console.error('remove-team: missing Supabase environment variables');
    return jsonResponse(request, { error: 'Server misconfigured' }, 500);
  }

  const serviceHeaders = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
  };

  try {
    const ownerRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        apikey: env.SUPABASE_ANON_KEY || serviceKey,
        Authorization: `Bearer ${ownerToken}`,
      },
    });
    if (!ownerRes.ok) {
      return jsonResponse(request, { error: 'Invalid owner token' }, 401);
    }
    const { id: ownerId } = await ownerRes.json();
    if (!ownerId) return jsonResponse(request, { error: 'Invalid owner token' }, 401);

    const ownerProfileRes = await fetch(
      `${supabaseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(ownerId)}&select=role,business_id`,
      { headers: serviceHeaders },
    );
    if (!ownerProfileRes.ok) {
      console.error('remove-team: owner profile lookup failed', await ownerProfileRes.text());
      return jsonResponse(request, { error: 'Could not verify account owner' }, 500);
    }
    const ownerProfiles = await ownerProfileRes.json();
    if (!ownerProfiles?.length || ownerProfiles[0].role !== 'owner') {
      return jsonResponse(request, { error: 'Only account owners can remove crew' }, 403);
    }

    const memberProfileRes = await fetch(
      `${supabaseUrl}/rest/v1/profiles?business_id=eq.${encodeURIComponent(ownerId)}&id=eq.${encodeURIComponent(memberId)}&select=id`,
      { headers: serviceHeaders },
    );
    if (!memberProfileRes.ok) {
      console.error('remove-team: member lookup failed', await memberProfileRes.text());
      return jsonResponse(request, { error: 'Could not verify crew member' }, 500);
    }
    const members = await memberProfileRes.json();
    if (!members?.length) {
      return jsonResponse(request, { error: 'Crew member not found' }, 404);
    }

    const unassignRes = await fetch(
      `${supabaseUrl}/rest/v1/jobs?assigned_to=eq.${encodeURIComponent(memberId)}`,
      {
        method: 'PATCH',
        headers: { ...serviceHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ assigned_to: null }),
      },
    );
    if (!unassignRes.ok) {
      console.error('remove-team: job unassignment failed', await unassignRes.text());
      return jsonResponse(request, { error: 'Could not unassign crew jobs' }, 500);
    }

    const detachRes = await fetch(
      `${supabaseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(memberId)}`,
      {
        method: 'PATCH',
        headers: { ...serviceHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ business_id: null, role: 'owner' }),
      },
    );
    if (!detachRes.ok) {
      console.error('remove-team: profile detach failed', await detachRes.text());
      return jsonResponse(request, { error: 'Could not detach crew member' }, 500);
    }

    return jsonResponse(request, { success: true }, 200);
  } catch (error) {
    console.error('remove-team: unexpected error', error);
    return jsonResponse(request, { error: 'Something went wrong' }, 500);
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
