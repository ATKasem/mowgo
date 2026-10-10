/**
 * POST /api/payments/webhook
 * Called by the active payment provider. The provider verifies its own
 * signature and normalizes events (contract.js); handling is shared.
 *
 * Dedup: event ids are namespaced `<provider>:<id>` in webhook_events and
 * recorded only AFTER processing succeeds, so a mid-handler failure is
 * retried by the provider instead of being skipped forever.
 */

import { handleBillingEvent } from '../_shared/payments/billing-events.js';
import { getPaymentProvider } from '../_shared/payments/registry.js';
import { eq, insertRow, requireSupabase, selectRows } from '../_shared/payments/supabase.js';

export async function onRequestPost({ request, env }) {
  const provider = getPaymentProvider(env);
  // No live provider: nothing can be verified. Acknowledge without acting.
  if (!provider) return ok();

  let events;
  try {
    events = await provider.parseWebhook(request);
  } catch (error) {
    console.error('payments webhook: parse failed:', error?.message || error);
    return ok();
  }
  // Invalid signature: don't reveal that, and don't invite retries.
  if (!Array.isArray(events)) return ok();

  try {
    requireSupabase(env);
    for (const event of events) {
      if (!event?.id || !event?.type) continue;
      const key = `${provider.name}:${event.id}`;
      if (await wasProcessed(env, key)) continue;
      await handleBillingEvent(env, provider, event);
      await markProcessed(env, key, provider.name);
    }
    return ok();
  } catch (error) {
    console.error('payments webhook: processing failed:', error?.message || error);
    return new Response('Webhook processing failed', { status: 500 });
  }
}

async function wasProcessed(env, key) {
  try {
    const rows = await selectRows(env, 'webhook_events', `event_id=${eq(key)}&select=event_id&limit=1`);
    return rows.length > 0;
  } catch (error) {
    // Fail open: an unreachable dedup table must not block real processing;
    // every handler step is idempotent.
    console.error('payments webhook: dedup check failed; processing anyway:', error?.message || error);
    return false;
  }
}

async function markProcessed(env, key, providerName) {
  try {
    const res = await insertRow(
      env, 'webhook_events', { event_id: key, provider: providerName }, 'resolution=ignore-duplicates,return=minimal',
    );
    if (!res.ok) console.error('payments webhook: dedup insert failed:', res.status);
  } catch (error) {
    // Processing already succeeded; a 500 here would cause a pointless retry.
    console.error('payments webhook: dedup insert failed:', error?.message || error);
  }
}

function ok() {
  return new Response('ok', { status: 200 });
}
