/**
 * POST /api/payments/billing-portal
 * Auth: Bearer <supabase access token>
 * Body: { platform?: 'ios'|'android' }
 * Returns: { url } — the provider's hosted page to manage card / plan / receipts.
 */

import { PaymentsUnavailableError } from '../_shared/payments/errors.js';
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

  try {
    const provider = getPaymentProvider(env);
    if (!provider) throw new PaymentsUnavailableError();
    requireSupabase(env);

    const [profile] = await selectRows(
      env, 'profiles', `id=${eq(user.id)}&select=billing_provider,billing_customer_id`,
    );
    if (profile?.billing_provider !== provider.name || !profile?.billing_customer_id) {
      return json({ error: 'No subscription found', code: 'no_subscription' }, 400, request);
    }

    const { url } = await provider.createBillingPortal({
      customerId: profile.billing_customer_id,
      returnUrl: returnUrls(env, platformOf(request, body), 'portal').success,
    });
    return json({ url: checkedHostedUrl(provider, url) }, 200, request);
  } catch (error) {
    return errorResponse(error, request, 'billing-portal');
  }
}
