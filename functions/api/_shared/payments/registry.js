/**
 * Picks the active payment provider from env.PAYMENTS_PROVIDER.
 * Returns null when none is set, the name is unknown, or the provider isn't
 * ready — callers treat null as "card payments unavailable" (HTTP 503).
 */

import { RiseProvider } from './providers/rise.js';

const PROVIDERS = {
  rise: RiseProvider,
};

/** Add a provider class under a PAYMENTS_PROVIDER name (also used by tests). */
export function registerPaymentProvider(name, ProviderClass) {
  PROVIDERS[String(name).toLowerCase()] = ProviderClass;
}

export function getPaymentProvider(env) {
  const name = String(env?.PAYMENTS_PROVIDER || '').trim().toLowerCase();
  const Provider = PROVIDERS[name];
  if (!Provider) return null;
  const provider = new Provider(env);
  return provider.isReady() ? provider : null;
}

/** Public, unauthenticated summary clients use to show or hide card UI. */
export function paymentsConfig(env) {
  const provider = getPaymentProvider(env);
  return {
    provider: provider ? provider.name : null,
    subscriptions: Boolean(provider),
    invoicePayments: Boolean(provider),
  };
}
