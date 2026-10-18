/**
 * Payment-layer errors. Endpoints map these to HTTP responses so every
 * client sees the same codes regardless of which provider is active.
 */

/** No provider is configured (or the configured one isn't implemented yet). */
export class PaymentsUnavailableError extends Error {
  constructor(message = 'Card payments are not available yet.') {
    super(message);
    this.name = 'PaymentsUnavailableError';
    this.code = 'payments_unavailable';
    this.status = 503;
  }
}

/** A provider method that hasn't been written yet (e.g. Rise before its API is wired). */
export class ProviderNotImplementedError extends Error {
  constructor(provider, method) {
    super(`${provider}: ${method} is not implemented yet`);
    this.name = 'ProviderNotImplementedError';
    this.code = 'provider_not_implemented';
    this.status = 503;
  }
}

/** The provider rejected or failed a request. Message is safe to log, not to show. */
export class ProviderRequestError extends Error {
  constructor(provider, message) {
    super(`${provider}: ${message}`);
    this.name = 'ProviderRequestError';
    this.code = 'provider_error';
    this.status = 502;
  }
}
