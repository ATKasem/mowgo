/**
 * Payment provider contract.
 *
 * Every provider (functions/api/_shared/payments/providers/*.js) exports a
 * class implementing the methods below. Endpoints and the billing-event
 * handler only ever talk to this interface — nothing outside providers/
 * may reference a specific processor's API.
 *
 * Money is always integer cents. Plans are 'solo' | 'crew' | 'premium';
 * intervals are 'month' | 'year'.
 *
 * Two money flows go through a provider:
 *   1. Subscriptions — a lawn-care business pays MowGo (platform account).
 *   2. Invoice payments — a business's customer pays THAT BUSINESS. These must
 *      settle to the business's own merchant account (merchant_accounts row),
 *      never to MowGo's platform account.
 *
 * @typedef {'solo'|'crew'|'premium'} Plan
 * @typedef {'month'|'year'} BillingInterval
 *
 * @typedef {Object} ReturnUrls
 * @property {string} success  Where the hosted page sends the payer on success.
 * @property {string} cancel   Where it sends them if they back out.
 *
 * @typedef {Object} PaymentProvider
 * @property {string} name  Short id stored in DB columns (e.g. 'rise').
 * @property {() => boolean} isReady
 *   True only when credentials are present AND the integration is implemented.
 *   The registry treats a not-ready provider as "payments unavailable".
 * @property {(host: string) => boolean} isAllowedHostedPageHost
 *   Hosted-page URLs returned by the provider are checked against this before
 *   they're handed to clients.
 *
 * @property {(args: {userId: string, email: string|null, existingCustomerId: string|null}) => Promise<string>} ensureCustomer
 *   Return the provider's customer id for this MowGo user, creating it if needed.
 * @property {(args: {customerId: string}) => Promise<{id: string, plan: Plan|null, status: string}|null>} getActiveSubscription
 *   The customer's current active/trialing/past-due subscription, or null.
 *   Used to refuse a second checkout (double-billing guard).
 * @property {(args: {customerId: string, userId: string, plan: Plan, interval: BillingInterval, trialDays: number, returnUrls: ReturnUrls}) => Promise<{url: string}>} createSubscriptionCheckout
 *   Hosted page where the business enters a card and starts the plan.
 *   trialDays is 0 when the user already used the in-app trial.
 * @property {(args: {customerId: string, returnUrl: string}) => Promise<{url: string}>} createBillingPortal
 *   Hosted page to update card / view receipts / change plan.
 * @property {(args: {customerId: string, subscriptionId: string|null}) => Promise<void>} cancelSubscription
 *   Cancel at period end. The provider's webhook then emits subscription.canceled.
 * @property {(args: {customerId: string, subscriptionId: string|null, extraSeats: number}) => Promise<void>} setExtraSeats
 *   Crew plan: bill for crew members beyond the first. Idempotent.
 * @property {(args: {customerId: string, amountCents: number, description: string}) => Promise<boolean>} applyAccountCredit
 *   Referral reward: credit applied to the customer's next renewal.
 *   Return false (never throw) if the provider can't do it; the caller logs
 *   it for manual reconciliation.
 *
 * @property {(args: {merchantAccountId: string, invoiceId: string, userId: string, amountCents: number, currency: string, description: string, returnUrls: ReturnUrls, previousProviderPaymentId: string|null}) => Promise<{url: string, providerPaymentId: string}>} createInvoicePayment
 *   Hosted payment page for one invoice, settling to the business's merchant
 *   account. Must carry invoiceId/userId so the webhook can match it back.
 *   When previousProviderPaymentId is set (the invoice amount changed), the
 *   provider MUST cancel/expire that earlier link first so a customer can't
 *   pay the stale amount — throw if it can't.
 *
 * @property {(request: Request) => Promise<NormalizedEvent[]|null>} parseWebhook
 *   Verify the signature and translate the provider's payload into zero or
 *   more NormalizedEvents. Return null when the signature is invalid.
 *
 * @typedef {Object} NormalizedEvent
 * @property {string} id  Provider event id (used for dedup; namespaced by provider).
 * @property {'subscription.active'|'subscription.canceled'|'subscription.payment_failed'|'invoice_payment.succeeded'|'invoice_payment.failed'} type
 * @property {string} [userId]          MowGo user id, when the provider echoes our metadata.
 * @property {string} [customerId]      Provider customer id.
 * @property {string} [subscriptionId]
 * @property {Plan|'free'} [plan]       Plan the subscription is now on.
 * @property {boolean} [isNew]          subscription.active: first activation (referral earn).
 * @property {string} [invoiceId]       invoice_payment.*: MowGo invoice id.
 * @property {string} [providerPaymentId]
 * @property {number} [amountCents]
 * @property {string} [currency]
 */

export const PLANS = ['solo', 'crew', 'premium'];
export const INTERVALS = ['month', 'year'];
export const EVENT_TYPES = [
  'subscription.active',
  'subscription.canceled',
  'subscription.payment_failed',
  'invoice_payment.succeeded',
  'invoice_payment.failed',
];
