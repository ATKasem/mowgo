/**
 * POST /api/payments/merchant-onboarding
 * Auth: Bearer <supabase access token> (the business owner)
 * Body: { platform?: 'ios'|'android' }
 * Returns: { url } — the provider's hosted page where this business applies
 * for / finishes its own merchant account, so invoice card payments settle
 * to the business (not to MowGo).
 *
 * Creates or refreshes the business's merchant_accounts row (status
 * 'pending' for a new application). Approval arrives later through the
 * provider's webhook (merchant.updated). Owners read their status straight
 * from merchant_accounts (RLS: own row, read-only).
 */

import { PaymentsUnavailableError } from '../_shared/payments/errors.js';
import {
  authenticate, checkedHostedUrl, errorResponse, json, platformOf, readJson, rejectForeignOrigin, returnUrls,
} from '../_shared/payments/http.js';
import { getPaymentProvider } from '../_shared/payments/registry.js';
import { eq, requireSupabase, selectRows, upsertRow } from '../_shared/payments/supabase.js';

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

    const [profile] = await selectRows(env, 'profiles', `id=${eq(user.id)}&select=role,business_name`);
    if (!profile) return json({ error: 'Profile not found' }, 404, request);
    // role defaults to 'owner' for every account; 'crew' is explicit.
    if (profile.role === 'crew') {
      return json({ error: 'Only the business owner can set up card payments.', code: 'not_owner' }, 403, request);
    }

    const [existing] = await selectRows(
      env, 'merchant_accounts', `user_id=${eq(user.id)}&select=provider,provider_merchant_id,status`,
    );
    const sameProvider = existing?.provider === provider.name;
    if (sameProvider && existing.status === 'active') {
      return json({ error: 'Card payments are already set up.', code: 'already_active' }, 409, request);
    }

    const { url, providerMerchantId } = await provider.createMerchantOnboarding({
      userId: user.id,
      email: user.email || null,
      businessName: profile.business_name || null,
      existingMerchantId: sameProvider ? existing.provider_merchant_id || null : null,
      returnUrl: returnUrls(env, platformOf(request, body), 'merchant').success,
    });
    const safeUrl = checkedHostedUrl(provider, url);

    await upsertRow(env, 'merchant_accounts', {
      user_id: user.id,
      provider: provider.name,
      provider_merchant_id: providerMerchantId || (sameProvider ? existing.provider_merchant_id : null) || null,
      // Keep a restricted/pending status while the business finishes; a new
      // application (or a provider switch) starts at pending.
      status: sameProvider ? existing.status : 'pending',
      updated_at: new Date().toISOString(),
    }, 'user_id');

    return json({ url: safeUrl }, 200, request);
  } catch (error) {
    return errorResponse(error, request, 'merchant-onboarding');
  }
}
