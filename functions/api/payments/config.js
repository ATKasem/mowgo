/**
 * GET /api/payments/config
 * Public. Tells clients whether card payments are live so they can show
 * "coming soon" instead of a button that fails.
 * Returns: { provider: string|null, subscriptions: boolean, invoicePayments: boolean }
 */

import { paymentsConfig } from '../_shared/payments/registry.js';
import { json } from '../_shared/payments/http.js';

export async function onRequestGet({ request, env }) {
  return json(paymentsConfig(env), 200, request);
}
