/**
 * Test helpers for the payments layer: a scriptable fake provider and a
 * fetch mock for Supabase REST/auth calls. Not imported by production code.
 */

export const SUPABASE_URL = 'https://example.supabase.co';

export const baseEnv = {
  SUPABASE_URL,
  SUPABASE_ANON_KEY: 'anon-key',
  SUPABASE_SERVICE_ROLE_KEY: 'service-key',
  APP_URL: 'https://mowgoapp.com',
  PAYMENTS_PROVIDER: 'fake',
};

/** Fake provider; override any method per test via `FakeProvider.behavior`. */
export class FakeProvider {
  static behavior = {};
  static calls = [];

  constructor(env) {
    this.env = env;
    this.name = 'fake';
  }

  isReady() { return FakeProvider.behavior.ready !== false; }
  isAllowedHostedPageHost(host) { return host === 'pay.fake.test'; }

  record(method, args) {
    FakeProvider.calls.push({ method, args });
    const impl = FakeProvider.behavior[method];
    return impl ? impl(args) : undefined;
  }

  async ensureCustomer(args) { return (await this.record('ensureCustomer', args)) ?? 'cus_new'; }
  async getActiveSubscription(args) { return (await this.record('getActiveSubscription', args)) ?? null; }
  async createSubscriptionCheckout(args) {
    return (await this.record('createSubscriptionCheckout', args)) ?? { url: 'https://pay.fake.test/checkout/1' };
  }
  async createBillingPortal(args) {
    return (await this.record('createBillingPortal', args)) ?? { url: 'https://pay.fake.test/portal/1' };
  }
  async cancelSubscription(args) { await this.record('cancelSubscription', args); }
  async setExtraSeats(args) { await this.record('setExtraSeats', args); }
  async applyAccountCredit(args) { return (await this.record('applyAccountCredit', args)) ?? true; }
  async createInvoicePayment(args) {
    return (await this.record('createInvoicePayment', args)) ?? { url: 'https://pay.fake.test/inv/2', providerPaymentId: 'pay_2' };
  }
  async parseWebhook(request) {
    const impl = FakeProvider.behavior.parseWebhook;
    return impl ? impl(request) : null;
  }
}

export function resetFake() {
  FakeProvider.behavior = {};
  FakeProvider.calls = [];
}

/**
 * Install a fetch mock. `routes` is a list of
 * { method, match: (url) => boolean, reply: (url, init) => Response|object }.
 * Unmatched requests throw so tests notice unexpected calls.
 */
export function mockFetch(routes) {
  const calls = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (input, init = {}) => {
    const url = String(input);
    const method = (init.method || 'GET').toUpperCase();
    const body = init.body ? safeParse(init.body) : undefined;
    calls.push({ url, method, body });
    const route = routes.find((r) => (r.method || 'GET') === method && r.match(url));
    if (!route) throw new Error(`Unexpected fetch: ${method} ${url}`);
    const result = await route.reply(url, { ...init, body });
    return result instanceof Response ? result : Response.json(result ?? []);
  };
  return { calls, restore: () => { globalThis.fetch = original; } };
}

function safeParse(body) {
  try { return JSON.parse(body); } catch { return body; }
}

export const authOk = (id = 'user-1', email = 'owner@example.com') => ({
  method: 'GET',
  match: (url) => url === `${SUPABASE_URL}/auth/v1/user`,
  reply: () => ({ id, email }),
});

export const rest = (method, table, reply, extraMatch = () => true) => ({
  method,
  match: (url) => url.startsWith(`${SUPABASE_URL}/rest/v1/${table}`) && extraMatch(url),
  reply,
});

export function apiRequest(path, { method = 'POST', body, origin, token = 'user-token' } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (origin) headers.Origin = origin;
  if (token) headers.Authorization = `Bearer ${token}`;
  return new Request(`https://mowgoapp.com${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
