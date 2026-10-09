/**
 * Shared — Update Crew seat billing
 *
 * Called whenever crew membership changes (invite accepted, member removed)
 * and when a Crew subscription activates. Counts the owner's crew members and
 * tells the active payment provider how many extra seats to bill (members
 * beyond the first are billed as an add-on).
 *
 * No-op when: no payment provider is ready, the owner isn't on Crew, or the
 * owner's billing account belongs to a different provider. Best-effort —
 * never throws to the caller.
 *
 * Exports: updateCrewQuantity(env, ownerId)
 */

import { getPaymentProvider } from './payments/registry.js';
import { eq, selectRows } from './payments/supabase.js';

// Serialize per owner so two membership changes can't race each other's count.
const ownerUpdates = new Map();

export async function updateCrewQuantity(env, ownerId) {
  const previous = ownerUpdates.get(ownerId) || Promise.resolve();
  const current = previous.catch(() => {}).then(() => reconcileCrewSeats(env, ownerId));
  ownerUpdates.set(ownerId, current);
  try {
    await current;
  } finally {
    if (ownerUpdates.get(ownerId) === current) ownerUpdates.delete(ownerId);
  }
}

async function reconcileCrewSeats(env, ownerId) {
  if (!ownerId) return;
  const provider = getPaymentProvider(env);
  if (!provider) return;

  try {
    const [profile] = await selectRows(
      env,
      'profiles',
      `id=${eq(ownerId)}&select=tier,billing_provider,billing_customer_id,billing_subscription_id`,
    );
    if (!profile || profile.tier !== 'crew') return;
    if (profile.billing_provider !== provider.name || !profile.billing_customer_id) return;

    const members = await selectRows(env, 'profiles', `business_id=${eq(ownerId)}&role=eq.crew&select=id`);
    const extraSeats = Math.max(0, members.length - 1);

    await provider.setExtraSeats({
      customerId: profile.billing_customer_id,
      subscriptionId: profile.billing_subscription_id || null,
      extraSeats,
    });
  } catch (e) {
    console.error('updateCrewQuantity failed:', e?.message || e);
  }
}
