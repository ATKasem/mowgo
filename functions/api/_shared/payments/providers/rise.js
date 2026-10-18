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
 *   RISE_PLAN_<PLAN>_<INTERVAL>  Rise plan ids, e.g. RISE_PLAN_CREW_MONTH
 *   RISE_PLAN_CREW_SEAT_<INTERVAL> optional: extra crew seat add-on plan ids
 *
 * How to implement: fill in each method below (each says what it must do and
 * return), using this.request() for API calls. Add sandbox tests to
 * rise.test.js, then flip IMPLEMENTED to true.
 */

import { ProviderNotImplementedError, ProviderRequestError } from '../errors.js';
import { INTERVALS, PLANS } from '../contract.js';

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

const REQUEST_TIMEOUT_MS = 15_000;

export class RiseProvider {
  /**
   * @param {object} env  Cloudflare env bindings.
   * @param {typeof fetch} [fetchImpl]  Injected in tests.
   */
  constructor(env, fetchImpl = (...args) => globalThis.fetch(...args)) {
    this.env = env;
    this.name = 'rise';
    this.fetch = fetchImpl;
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

  // --- Plumbing (ready to use) ---------------------------------------------

  /** Rise plan id for a MowGo plan + interval (RISE_PLAN_CREW_MONTH, …). */
  planId(plan, interval) {
    if (!PLANS.includes(plan) || !INTERVALS.includes(interval)) {
      throw new ProviderRequestError(this.name, `unknown plan ${plan}/${interval}`);
    }
    const key = `RISE_PLAN_${plan.toUpperCase()}_${interval.toUpperCase()}`;
    const id = this.env[key];
    if (!id) throw new ProviderRequestError(this.name, `${key} is not configured`);
    return id;
  }

  /** Reverse of planId — maps a Rise plan id from a webhook back to MowGo. */
  planFor(risePlanId) {
    for (const plan of PLANS) {
      for (const interval of INTERVALS) {
        if (risePlanId && this.env[`RISE_PLAN_${plan.toUpperCase()}_${interval.toUpperCase()}`] === risePlanId) {
          return { plan, interval };
        }
      }
    }
    return null;
  }

  /**
   * Authenticated JSON request to the Rise / MX Merchant API.
   * Pinned to RISE_API_BASE_URL (https only); failures throw
   * ProviderRequestError without echoing response bodies (may hold PII).
   *
   * @param {'GET'|'POST'|'PUT'|'PATCH'|'DELETE'} method
   * @param {string} path  e.g. '/checkout/v3/payment' (relative to the base URL)
   * @param {{body?: object, query?: Record<string, string|number>}} [options]
   */
  async request(method, path, { body, query } = {}) {
    let base;
    try {
      base = new URL(String(this.env.RISE_API_BASE_URL || ''));
    } catch {
      throw new ProviderRequestError(this.name, 'RISE_API_BASE_URL is not a valid URL');
    }
    if (base.protocol !== 'https:') throw new ProviderRequestError(this.name, 'RISE_API_BASE_URL must be https');

    const basePath = base.pathname.endsWith('/') ? base.pathname : `${base.pathname}/`;
    const url = new URL(String(path).replace(/^\/+/, ''), `${base.origin}${basePath}`);
    if (url.origin !== base.origin) throw new ProviderRequestError(this.name, 'request path escaped the API base URL');
    for (const [k, v] of Object.entries(query || {})) url.searchParams.set(k, String(v));

    const credentials = btoa(`${this.env.RISE_API_KEY || ''}:${this.env.RISE_API_SECRET || ''}`);
    let res;
    try {
      res = await this.fetch(url.toString(), {
        method,
        headers: {
          Authorization: `Basic ${credentials}`,
          Accept: 'application/json',
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      throw new ProviderRequestError(this.name, `${method} ${url.pathname} failed: ${error?.name || 'network error'}`);
    }

    const text = await res.text();
    if (!res.ok) throw new ProviderRequestError(this.name, `${method} ${url.pathname} returned ${res.status}`);
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch {
      throw new ProviderRequestError(this.name, `${method} ${url.pathname} returned non-JSON`);
    }
  }

  notImplemented(method) {
    throw new ProviderNotImplementedError(this.name, method);
  }

  // --- Subscriptions: a business pays MowGo (RISE_PLATFORM_MERCHANT_ID) -----

  /** Return Rise's customer id for this user, creating the customer if needed. */
  async ensureCustomer(/* { userId, email, existingCustomerId } */) { this.notImplemented('ensureCustomer'); }

  /**
   * The customer's live recurring contract, or null.
   * Return { id, plan (via planFor), status }. Count active, trialing and
   * past-due as live (double-billing guard).
   */
  async getActiveSubscription(/* { customerId } */) { this.notImplemented('getActiveSubscription'); }

  /**
   * Hosted page that captures a card and starts a recurring contract on
   * this.planId(plan, interval), with trialDays free days (0 = bill now).
   * Must carry userId as metadata so webhooks can match it. Return { url }.
   */
  async createSubscriptionCheckout(/* { customerId, userId, plan, interval, trialDays, returnUrls } */) {
    this.notImplemented('createSubscriptionCheckout');
  }

  /** Hosted page to update the card / see receipts. Return { url }. */
  async createBillingPortal(/* { customerId, returnUrl } */) { this.notImplemented('createBillingPortal'); }

  /** Cancel the contract at period end. Rise's webhook then reports it. */
  async cancelSubscription(/* { customerId, subscriptionId } */) { this.notImplemented('cancelSubscription'); }

  /** Crew plan: bill extraSeats add-on seats (RISE_PLAN_CREW_SEAT_*). Idempotent. */
  async setExtraSeats(/* { customerId, subscriptionId, extraSeats } */) { this.notImplemented('setExtraSeats'); }

  /** Referral reward credit on the next renewal. Return false if unsupported (never throw). */
  async applyAccountCredit(/* { customerId, amountCents, description } */) { return false; }

  // --- Merchant onboarding: each lawn business gets its own merchant ---------

  /**
   * Hosted application / boarding page for the business's own merchant
   * account. Return { url, providerMerchantId } (merchant id may be null
   * until the application exists). Approval arrives as merchant.updated.
   */
  async createMerchantOnboarding(/* { userId, email, businessName, existingMerchantId, returnUrl } */) {
    this.notImplemented('createMerchantOnboarding');
  }

  // --- Invoice payments: a customer pays the business ------------------------

  /**
   * Hosted payment page / payment link for amountCents on the BUSINESS's
   * merchant (merchantAccountId), never the platform merchant. Carry
   * invoiceId + userId as metadata. If previousProviderPaymentId is set,
   * cancel/expire that link first and throw if you can't.
   * Return { url, providerPaymentId }.
   */
  async createInvoicePayment(/* args */) { this.notImplemented('createInvoicePayment'); }

  // --- Webhooks --------------------------------------------------------------

  /**
   * Authenticate the callback using Rise's scheme (ask Rise — public MX
   * docs don't describe signing) with RISE_WEBHOOK_SECRET and a
   * constant-time compare, then map payloads to NormalizedEvents
   * (contract.js): subscription.active / .canceled / .payment_failed,
   * invoice_payment.succeeded / .failed, merchant.updated.
   * Return null for any unauthenticated request. Fails closed until written.
   */
  async parseWebhook(/* request */) { return null; }
}
