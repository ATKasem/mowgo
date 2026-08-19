/**
 * Shared — Update Crew Subscription Add-On Quantity
 *
 * Called whenever crew membership changes (invite accepted, member removed).
 * Counts the owner's current crew members and updates the Stripe
 * subscription add-on line item so billing stays in sync.
 *
 * If the owner isn't on the Crew tier, this is a no-op.
 * If Stripe env vars aren't configured, this is a no-op (best-effort).
 * Picks the monthly or annual add-on price to match the subscription's
 * actual billing interval — Stripe rejects mixed-interval line items.
 *
 * Exports: updateCrewQuantity(env, ownerId)
 */

const STRIPE_API = 'https://api.stripe.com/v1';
const billableStatuses = new Set(['active', 'trialing', 'past_due']);
const ownerUpdates = new Map();

export async function updateCrewQuantity(env, ownerId) {
  // Serialize updates for an owner within an isolate. The reconciler also
  // re-reads the database before every Stripe write, so a queued invite/remove
  // always applies the latest membership count rather than a captured delta.
  const previous = ownerUpdates.get(ownerId) || Promise.resolve();
  const current = previous.catch(() => {}).then(() => reconcileCrewQuantity(env, ownerId));
  ownerUpdates.set(ownerId, current);
  try {
    await current;
  } finally {
    if (ownerUpdates.get(ownerId) === current) ownerUpdates.delete(ownerId);
  }
}

async function reconcileCrewQuantity(env, ownerId) {
  if (!ownerId || !env.STRIPE_SECRET_KEY) return;

  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_KEY;
  if (!env.SUPABASE_URL || !serviceKey) return;

  const addonPriceMonth = env.STRIPE_PRICE_CREW_ADDON;
  const addonPriceYear = env.STRIPE_PRICE_CREW_ADDON_ANNUAL;
  if (!addonPriceMonth && !addonPriceYear) return; // neither add-on configured yet — no-op

  try {
    // Step 1: Get owner profile (tier + stripe_customer_id)
    const profileRes = await fetch(
      `${env.SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(ownerId)}&select=tier,stripe_customer_id`,
      { headers: { apikey: serviceKey, 'Authorization': `Bearer ${serviceKey}` } },
    );
    if (!profileRes.ok) return;
    const [profile] = await profileRes.json();
    if (!profile || !profile.stripe_customer_id) return;
    if (profile.tier !== 'crew') return;  // Only reconcile crew add-ons for crew-tier owners

    // Step 2: Fetch the customer's subscriptions once — used both for the
    // Crew-tier reconciliation below and for the downgrade cleanup path.
    const subsRes = await fetch(
      `${STRIPE_API}/subscriptions?customer=${encodeURIComponent(profile.stripe_customer_id)}&status=all&limit=100`,
      { headers: { 'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}` } },
    );
    if (!subsRes.ok) return;
    const subsData = await subsRes.json();
    const priceIdOf = item => (typeof item.price === 'string' ? item.price : item.price?.id);
    const addonPriceIds = new Set([addonPriceMonth, addonPriceYear].filter(Boolean));
    const billable = (subsData.data || []).filter(
      subscription => billableStatuses.has(subscription.status) && !subscription.pause_collection,
    );

    if (profile.tier !== 'crew') {
      // Owner is no longer on the Crew tier — most commonly because they
      // switched plans in place via the Stripe customer portal, which swaps
      // the base line item's price on the SAME subscription without
      // touching unrelated line items. The metered add-on item added by
      // this helper would otherwise keep billing forever with nothing left
      // to reconcile it away, so remove any stray add-on items directly.
      for (const subscription of billable) {
        const items = subscription.items?.data || [];
        for (const item of items) {
          if (!addonPriceIds.has(priceIdOf(item))) continue;
          const res = await fetch(`${STRIPE_API}/subscription_items/${encodeURIComponent(item.id)}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}`,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({ proration_behavior: 'none' }).toString(),
          });
          if (!res.ok) console.error('updateCrewQuantity: stray add-on cleanup failed', await res.text());
        }
      }
      return;
    }

    // Step 3: Find the owner's one billable Crew subscription. Do not mutate an
    // arbitrary subscription when test artifacts or duplicate subscriptions
    // exist on the same customer.
    const crewBasePrices = new Set([env.STRIPE_PRICE_CREW, env.STRIPE_PRICE_CREW_ANNUAL].filter(Boolean));
    const subscriptions = billable.filter(subscription => {
      const items = subscription.items?.data || [];
      return items.some(item => crewBasePrices.has(priceIdOf(item)));
    });
    if (subscriptions.length !== 1) {
      if (subscriptions.length > 1) console.error('updateCrewQuantity: multiple billable Crew subscriptions; refusing ambiguous update');
      return;
    }
    const [subscription] = subscriptions;

    // Step 3: Determine billing interval from the base (non-add-on) line item.
    // Stripe rejects subscriptions that mix monthly and yearly recurring prices,
    // so an annual Crew subscription MUST use the annual add-on price, not the
    // monthly one, or the write below will be rejected outright.
    const items = subscription.items?.data || [];
    const baseItem = items.find(item => crewBasePrices.has(priceIdOf(item)))
      || items.find(item => !addonPriceIds.has(priceIdOf(item)));
    const interval = baseItem?.price?.recurring?.interval;
    if (interval !== 'month' && interval !== 'year') return;
    const addonPrice = interval === 'year' ? addonPriceYear : addonPriceMonth;
    if (!addonPrice) return; // this billing interval's add-on price isn't configured yet — no-op

    // Step 4: Count immediately before the Stripe mutation. This is a desired
    // state reconciliation, not an increment/decrement, so retries are safe.
    const countRes = await fetch(
      `${env.SUPABASE_URL}/rest/v1/profiles?business_id=eq.${encodeURIComponent(ownerId)}&role=eq.crew&select=id`,
      { headers: { apikey: serviceKey, 'Authorization': `Bearer ${serviceKey}` } },
    );
    if (!countRes.ok) return;
    const members = await countRes.json();
    if (!Array.isArray(members)) return;
    const addonQty = Math.max(0, members.length - 1);

    // Step 5: Find or create the add-on line item.
    // Two concurrent reconciliations for the same owner (different isolates —
    // the in-memory ownerUpdates queue only serializes within one isolate)
    // can both see "no add-on item yet" and both create one. .find() would
    // silently ignore the duplicate on every future call, permanently
    // stranding it at a stale quantity, so clean up any extras here instead.
    const [addonItem, ...duplicateAddonItems] = items.filter(item => priceIdOf(item) === addonPrice);
    for (const dup of duplicateAddonItems) {
      const res = await fetch(`${STRIPE_API}/subscription_items/${encodeURIComponent(dup.id)}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ proration_behavior: 'none' }).toString(),
      });
      if (!res.ok) console.error('updateCrewQuantity: duplicate add-on cleanup failed', await res.text());
    }

    if (addonItem && addonItem.quantity === addonQty) {
      // Already correct — nothing to do
      return;
    }

    // Step 6: Update the add-on quantity
    // If addonQty is 0 and there's no add-on item, nothing to change.
    // If addonQty is 0 and there IS an add-on item, remove it.
    // If addonQty > 0 and there's no add-on item, add one.
    // If addonQty > 0 and there IS an add-on item, update its quantity.

    if (addonItem) {
      if (addonQty === 0) {
        // Remove the add-on line item. proration_behavior=none matches the
        // add/update calls below — without it Stripe defaults to issuing a
        // prorated credit for a period that was never separately invoiced.
        const res = await fetch(`${STRIPE_API}/subscription_items/${encodeURIComponent(addonItem.id)}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({ proration_behavior: 'none' }).toString(),
        });
        if (!res.ok) console.error('updateCrewQuantity: remove add-on failed', await res.text());
      } else {
        // Update quantity
        const res = await fetch(`${STRIPE_API}/subscription_items/${encodeURIComponent(addonItem.id)}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({ quantity: String(addonQty), proration_behavior: 'none' }).toString(),
        });
        if (!res.ok) console.error('updateCrewQuantity: update add-on quantity failed', await res.text());
      }
    } else if (addonQty > 0) {
      // Add the add-on line item
      const res = await fetch(`${STRIPE_API}/subscription_items`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          subscription: subscription.id,
          price: addonPrice,
          quantity: String(addonQty),
          proration_behavior: 'none',
        }).toString(),
      });
      if (!res.ok) console.error('updateCrewQuantity: add add-on item failed', await res.text());
    }
  } catch (e) {
    // Best-effort — never fail the caller over billing sync
    console.error('updateCrewQuantity failed:', e);
  }
}
