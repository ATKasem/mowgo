import { onRequestPost as __api_stripe_checkout_subscription_js_onRequestPost } from "/opt/data/mowgo/functions/api/stripe/checkout-subscription.js"
import { onRequestPost as __api_stripe_create_portal_session_js_onRequestPost } from "/opt/data/mowgo/functions/api/stripe/create-portal-session.js"
import { onRequestGet as __api_stripe_verify_session_js_onRequestGet } from "/opt/data/mowgo/functions/api/stripe/verify-session.js"
import { onRequestPost as __api_stripe_webhook_js_onRequestPost } from "/opt/data/mowgo/functions/api/stripe/webhook.js"
import { onRequestOptions as __api_autopilot_js_onRequestOptions } from "/opt/data/mowgo/functions/api/autopilot.js"
import { onRequestPost as __api_autopilot_js_onRequestPost } from "/opt/data/mowgo/functions/api/autopilot.js"

export const routes = [
    {
      routePath: "/api/stripe/checkout-subscription",
      mountPath: "/api/stripe",
      method: "POST",
      middlewares: [],
      modules: [__api_stripe_checkout_subscription_js_onRequestPost],
    },
  {
      routePath: "/api/stripe/create-portal-session",
      mountPath: "/api/stripe",
      method: "POST",
      middlewares: [],
      modules: [__api_stripe_create_portal_session_js_onRequestPost],
    },
  {
      routePath: "/api/stripe/verify-session",
      mountPath: "/api/stripe",
      method: "GET",
      middlewares: [],
      modules: [__api_stripe_verify_session_js_onRequestGet],
    },
  {
      routePath: "/api/stripe/webhook",
      mountPath: "/api/stripe",
      method: "POST",
      middlewares: [],
      modules: [__api_stripe_webhook_js_onRequestPost],
    },
  {
      routePath: "/api/autopilot",
      mountPath: "/api",
      method: "OPTIONS",
      middlewares: [],
      modules: [__api_autopilot_js_onRequestOptions],
    },
  {
      routePath: "/api/autopilot",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_autopilot_js_onRequestPost],
    },
  ]