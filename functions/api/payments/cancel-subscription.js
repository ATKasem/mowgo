/**
 * POST /api/payments/cancel-subscription
 * Auth: Bearer <supabase access token>
 * Cancels at period end. The tier drops to free when the provider's webhook
 * reports the cancellation (subscription.canceled), not here.
 * Returns: { success: true }
 */

import { PaymentsUnavailableError } from '../_shared/payments/errors.js';
import { authenticate, errorResponse, json, rejectForeignOrigin } from '../_shared/payments/http.js';
import { getPaymentProvider } from '../_shared/payments/registry.js';
import { eq, requireSupabase, selectRows } from '../_shared/payments/supabase.js';

export async function onRequestPost({ request, env }) {
  const forbidden = rejectForeignOrigin(request);
  if (forbidden) return forbidden;

  const user = await authenticate(request, env);
  if (!user) return json({ error: 'Unauthorized' }, 401, request);

  try {
    const provider = getPaymentProvider(env);
    if (!provider) throw new PaymentsUnavailableError();
    requireSupabase(env);

    const [profile] = await selectRows(
      env, 'profiles', `id=${eq(user.id)}&select=billing_provider,billing_customer_id,billing_subscription_id`,
    );
    if (profile?.billing_provider !== provider.name || !profile?.billing_customer_id) {
      return json({ error: 'No subscription found', code: 'no_subscription' }, 400, request);
    }

    await provider.cancelSubscription({
      customerId: profile.billing_customer_id,
      subscriptionId: profile.billing_subscription_id || null,
    });
    return json({ success: true }, 200, request);
  } catch (error) {
    return errorResponse(error, request, 'cancel-subscription');
  }
}
