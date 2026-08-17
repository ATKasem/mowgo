/**
 * Cloudflare Pages Function — Referral notification
 *
 * Called by the apply_referral_code database function via pg_net when a
 * referral is successfully applied. Sends:
 *   1. Discord notification (if webhook URL is configured)
 *   2. Push notification via Supabase send-push edge function
 */

export async function onRequestPost({ request, env }) {
  // Verify it's called by Supabase (service role key)
  const auth = request.headers.get('Authorization');
  if (auth !== `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { referrer_id, referrer_name, new_user_id, code_used } = await request.json();

  if (!referrer_id) {
    return new Response('Missing referrer_id', { status: 400 });
  }

  const errors = [];

  // 1. Discord notification
  const webhookUrl = env.DISCORD_REFERRAL_WEBHOOK_URL;
  if (webhookUrl) {
    try {
      const displayName = referrer_name || `User ${referrer_id.slice(0, 8)}`;
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: `🎉 **Referral applied!**\n**Referrer:** ${displayName}\n**Code used:** ${code_used}\n**New user:** ${new_user_id.slice(0, 8)}...`,
          allowed_mentions: { parse: [] }
        })
      });
    } catch (e) {
      errors.push('discord:' + e.message);
    }
  }

  // 2. Push notification to the referrer
  const supabaseUrl = env.SUPABASE_URL;
  if (supabaseUrl) {
    try {
      await fetch(`${supabaseUrl}/functions/v1/send-push`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`
        },
        body: JSON.stringify({
          userId: referrer_id,
          title: '🎉 New referral!',
          body: `Someone signed up using your referral code. You've earned a free month when they pay their first invoice.`
        })
      });
    } catch (e) {
      errors.push('push:' + e.message);
    }
  }

  const status = errors.length === 0 ? 200 : 207;
  return Response.json({ ok: errors.length === 0, errors }, { status });
}

export async function onRequest({ request, env }) {
  if (request.method === 'POST') return onRequestPost({ request, env });
  return new Response('Method not allowed', { status: 405 });
}