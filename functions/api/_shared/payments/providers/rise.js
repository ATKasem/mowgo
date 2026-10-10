/**
 * Rise Concepts payment provider — MowGo's processor (Stripe has been
 * removed). NOT IMPLEMENTED YET: every method needs Rise's API.
 *
 * Rise's processing runs on Priority's MX Merchant platform. From MX
 * Merchant's public developer hub (developer.mxmerchant.com — unverified
 * against a sandbox; confirm with Rise):
 *   - "Checkout API" v3, REST, separate Sandbox and Production environments;
 *     auth is HTTP Basic or OAuth 1.0a.
 *   - Recurring billing = "contracts" (create / update / get / cancel, list a
 *     contract's payments and history). Requires the Invoice App to be
 *     activated in the merchant's MX Merchant portal.
 *   - Notifications can be delivered to a webhook callback URL; "sources"
 *     select which payment channels trigger them (API, QuickPay, Recurring).
 *     The API sets up one event per notification. Public docs don't describe
 *     webhook signing — ASK RISE how callbacks are authenticated; parseWebhook
 *     must reject unauthenticated calls.
 *
 * Still needed from Rise before this can be written:
 *   - API docs + sandbox credentials
 *   - Sub-merchant onboarding: each lawn business must be its own merchant so
 *     invoice payments settle to them, not to MowGo (merchant_accounts table)
 *   - Hosted payment page / payment links with success + cancel redirects,
 *     and a way to cancel/expire a link
 *   - Webhook authentication scheme + event payloads (payment + recurring)
 *   - Contract quantity changes (crew seats) and customer credit (referrals)
 *
 * Until isReady() returns true the registry reports payments as unavailable.
 * Rise is the default provider (PAYMENTS_PROVIDER may be left unset).
 *
 * Env (Cloudflare Pages dashboard — never commit values):
 *   RISE_API_BASE_URL       sandbox or production Checkout API base URL
 *   RISE_API_KEY            API credential (Basic auth username / consumer key)
 *   RISE_API_SECRET         API credential (Basic auth password / secret)
 *   RISE_PLATFORM_MERCHANT_ID  MowGo's own merchant id (subscriptions)
 *   RISE_WEBHOOK_SECRET     whatever Rise uses to authenticate callbacks
 *   RISE_HOSTED_PAGE_HOSTS  comma-separated hosts hosted pages may live on
 *   RISE_PLAN_<PLAN>_<INTERVAL>  plan ids/amounts, e.g. RISE_PLAN_CREW_MONTH
 */

import { ProviderNotImplementedError } from '../errors.js';

// Flip to true once every method below is implemented and tested in sandbox.
const IMPLEMENTED = false;

const REQUIRED_ENV = [
  'RISE_API_BASE_URL',
  'RISE_API_KEY',
  'RISE_API_SECRET',
  'RISE_PLATFORM_MERCHANT_ID',
  'RISE_WEBHOOK_SECRET',
  'RISE_HOSTED_PAGE_HOSTS',
];

export class RiseProvider {
  constructor(env) {
    this.env = env;
    this.name = 'rise';
  }

  isReady() {
    return IMPLEMENTED && REQUIRED_ENV.every((key) => Boolean(this.env[key]));
  }

  isAllowedHostedPageHost(host) {
    const allowed = String(this.env.RISE_HOSTED_PAGE_HOSTS || '')
      .split(',')
      .map((h) => h.trim().toLowerCase())
      .filter(Boolean);
    return allowed.includes(String(host || '').toLowerCase());
  }

  notImplemented(method) {
    throw new ProviderNotImplementedError(this.name, method);
  }

  // --- Subscriptions (business pays MowGo) ---------------------------------
  async ensureCustomer() { this.notImplemented('ensureCustomer'); }
  async getActiveSubscription() { this.notImplemented('getActiveSubscription'); }
  async createSubscriptionCheckout() { this.notImplemented('createSubscriptionCheckout'); }
  async createBillingPortal() { this.notImplemented('createBillingPortal'); }
  async cancelSubscription() { this.notImplemented('cancelSubscription'); }
  async setExtraSeats() { this.notImplemented('setExtraSeats'); }
  async applyAccountCredit() { return false; }

  // --- Invoice payments (customer pays the business) -----------------------
  async createInvoicePayment() { this.notImplemented('createInvoicePayment'); }

  // --- Webhooks ------------------------------------------------------------
  // Must verify the signature with RISE_WEBHOOK_SECRET (constant-time compare,
  // timestamp tolerance) and return null on failure.
  async parseWebhook() { return null; }
}
