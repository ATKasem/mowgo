/**
 * Rise Concepts payment provider — NOT IMPLEMENTED YET.
 *
 * Rise Concepts' processing appears to run on the MX Merchant platform
 * (Priority). Waiting on from Rise before this can be written:
 *   - API docs + sandbox credentials (confirm whether it's the MX Merchant API)
 *   - Sub-merchant onboarding: each lawn business must be its own merchant so
 *     invoice payments settle to them, not to MowGo (merchant_accounts table)
 *   - Hosted payment page / payment links with success + cancel redirects
 *   - Signed webhooks for payment + recurring-billing events
 *   - Recurring billing API: create plan subscription, change quantity
 *     (crew seats), cancel, customer credit (referrals)
 *
 * Until isReady() returns true the registry reports payments as unavailable,
 * so setting PAYMENTS_PROVIDER=rise early is harmless.
 *
 * Env (Cloudflare Pages dashboard — never commit values):
 *   RISE_API_BASE_URL       e.g. sandbox vs production base URL
 *   RISE_API_KEY            API credential
 *   RISE_API_SECRET         API credential
 *   RISE_PLATFORM_MERCHANT_ID  MowGo's own merchant id (subscriptions)
 *   RISE_WEBHOOK_SECRET     webhook signature secret
 *   RISE_HOSTED_PAGE_HOSTS  comma-separated hosts hosted pages may live on
 *   RISE_PLAN_<PLAN>_<INTERVAL>  provider plan ids, e.g. RISE_PLAN_CREW_MONTH
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
