/**
 * POST /api/payments/subscription-checkout
 * Auth: Bearer <supabase access token>
 * Body: { plan: 'solo'|'crew'|'premium', interval?: 'month'|'year', platform?: 'ios'|'android' }
 * Returns: { url } — the provider's hosted checkout page.
 * 503 { code: 'payments_unavailable' } until a provider is live.
 */

import { INTERVALS, PLANS } from '../_shared/payments/contract.js';
import { PaymentsUnavailableError, ProviderRequestError } from '../_shared/payments/errors.js';
import { ensureBillingCustomer } from '../_shared/payments/billing-events.js';
import {
  authenticate, checkedHostedUrl, errorResponse, json, platformOf, readJson, rejectForeignOrigin, returnUrls,
} from '../_shared/payments/http.js';
import { getPaymentProvider } from '../_shared/payments/registry.js';
import { eq, requireSupabase, selectRows } from '../_shared/payments/supabase.js';

export async function onRequestPost({ request, env }) {
  const forbidden = rejectForeignOrigin(request);
  if (forbidden) return forbidden;

  const user = await authenticate(request, env);
  if (!user) return json({ error: 'Unauthorized' }, 401, request);

  const body = await readJson(request);
  const { plan, interval = 'month' } = body;
  if (!PLANS.includes(plan)) return json({ error: 'Invalid plan' }, 400, request);
  if (!INTERVALS.includes(interval)) return json({ error: 'Invalid billing interval' }, 400, request);

  try {
    const provider = getPaymentProvider(env);
    if (!provider) throw new PaymentsUnavailableError();
    requireSupabase(env);

    const [profile] = await selectRows(env, 'profiles', `id=${eq(user.id)}&select=id,trial_ends_at`);
    if (!profile) return json({ error: 'Profile not found' }, 404, request);

    const customerId = await ensureBillingCustomer(env, provider, user.id);
    if (!customerId) throw new ProviderRequestError(provider.name, 'could not create or save billing customer');

    // Fail closed: never open a second checkout for someone already paying.
    const active = await provider.getActiveSubscription({ customerId });
    if (active) {
      return json({
        error: 'You already have an active subscription. Manage it from Settings.',
        code: 'already_subscribed',
      }, 409, request);
    }

    // Users who already had the in-app trial convert without a second trial.
    const trialDays = profile.trial_ends_at ? 0 : (Number.parseInt(env.SUBSCRIPTION_TRIAL_DAYS || '14', 10) || 14);

    const { url } = await provider.createSubscriptionCheckout({
      customerId,
      userId: user.id,
      plan,
      interval,
      trialDays,
      returnUrls: returnUrls(env, platformOf(request, body), 'subscription'),
    });
    return json({ url: checkedHostedUrl(provider, url) }, 200, request);
  } catch (error) {
    return errorResponse(error, request, 'subscription-checkout');
  }
}
