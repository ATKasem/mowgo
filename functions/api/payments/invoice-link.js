/**
 * POST /api/payments/invoice-link
 * Auth: Bearer <supabase access token> (the business owner)
 * Body: { invoice_id: uuid }
 * Returns: { url } — hosted page where the business's customer pays this
 * invoice. The money settles to the business's own merchant account.
 *
 * One live link per invoice: the stored link is reused while the amount is
 * unchanged. If the amount changed, the provider cancels the old link and a
 * new one is created. The invoice is marked paid only by the provider's
 * webhook (invoice_payment.succeeded), never by the client.
 */

import { amountToCents } from '../_shared/payments/billing-events.js';
import { PaymentsUnavailableError } from '../_shared/payments/errors.js';
import {
  authenticate, checkedHostedUrl, errorResponse, json, readJson, rejectForeignOrigin, returnUrls,
} from '../_shared/payments/http.js';
import { getPaymentProvider } from '../_shared/payments/registry.js';
import { eq, patchRows, requireSupabase, selectRows } from '../_shared/payments/supabase.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function onRequestPost({ request, env }) {
  const forbidden = rejectForeignOrigin(request);
  if (forbidden) return forbidden;

  const user = await authenticate(request, env);
  if (!user) return json({ error: 'Unauthorized' }, 401, request);

  const { invoice_id: invoiceId } = await readJson(request);
  if (typeof invoiceId !== 'string' || !UUID_RE.test(invoiceId)) {
    return json({ error: 'invoice_id required' }, 400, request);
  }

  try {
    const provider = getPaymentProvider(env);
    if (!provider) throw new PaymentsUnavailableError();
    requireSupabase(env);

    // Service role, so filter by the caller's own id: owners only see their invoices.
    const [invoice] = await selectRows(
      env,
      'invoices',
      `id=${eq(invoiceId)}&user_id=${eq(user.id)}&select=id,amount,status,payment_provider,provider_payment_id,payment_link_url,payment_link_amount_cents,clients(name)`,
    );
    if (!invoice) return json({ error: 'Invoice not found' }, 404, request);
    if (invoice.status === 'paid') return json({ error: 'This invoice is already paid.', code: 'already_paid' }, 409, request);
    if (invoice.status === 'voided') return json({ error: 'This invoice was voided.', code: 'voided' }, 409, request);

    const amountCents = amountToCents(invoice.amount);
    if (amountCents === null) return json({ error: 'Invalid invoice amount' }, 422, request);

    const [merchant] = await selectRows(
      env,
      'merchant_accounts',
      `user_id=${eq(user.id)}&provider=${eq(provider.name)}&select=provider_merchant_id,status`,
    );
    if (merchant?.status !== 'active' || !merchant?.provider_merchant_id) {
      return json({
        error: 'Finish setting up card payments for your business first.',
        code: 'merchant_not_ready',
      }, 409, request);
    }

    const sameProvider = invoice.payment_provider === provider.name;
    if (sameProvider && invoice.payment_link_url && invoice.payment_link_amount_cents === amountCents) {
      return json({ url: checkedHostedUrl(provider, invoice.payment_link_url) }, 200, request);
    }

    const { url, providerPaymentId } = await provider.createInvoicePayment({
      merchantAccountId: merchant.provider_merchant_id,
      invoiceId,
      userId: user.id,
      amountCents,
      currency: 'usd',
      description: `Invoice for ${invoice.clients?.name || 'services'}`,
      returnUrls: returnUrls(env, 'web', 'invoice'),
      previousProviderPaymentId: sameProvider ? invoice.provider_payment_id || null : null,
    });
    const safeUrl = checkedHostedUrl(provider, url);

    // Compare-and-set on the previous payment id so two concurrent requests
    // can't both store a link.
    const previousFilter = invoice.provider_payment_id ? eq(invoice.provider_payment_id) : 'is.null';
    const saved = await patchRows(
      env,
      'invoices',
      `id=${eq(invoiceId)}&user_id=${eq(user.id)}&provider_payment_id=${previousFilter}&status=in.(unpaid,overdue)`,
      {
        payment_provider: provider.name,
        provider_payment_id: providerPaymentId,
        payment_link_url: safeUrl,
        payment_link_amount_cents: amountCents,
      },
    );
    if (saved.length === 0) {
      return json({ error: 'The invoice changed. Please try again.', code: 'conflict' }, 409, request);
    }
    return json({ url: safeUrl }, 200, request);
  } catch (error) {
    return errorResponse(error, request, 'invoice-link');
  }
}
