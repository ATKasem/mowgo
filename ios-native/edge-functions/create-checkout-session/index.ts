// Supabase Edge Function: create-checkout-session
// Creates a Stripe Checkout session for subscription upgrades.
//
// Deploy: supabase functions deploy create-checkout-session
//
// Required env vars:
//   STRIPE_SECRET_KEY     — your Stripe secret key
//   STRIPE_PRICE_SOLO     — Stripe Price ID for Solo tier (price_xxx)
//   STRIPE_PRICE_CREW     — Stripe Price ID for Crew tier (price_xxx)
//   STRIPE_TRIAL_DAYS     — optional, defaults to 14 to match web checkout
//
// Supabase automatically provides SUPABASE_URL, SUPABASE_ANON_KEY, and
// SUPABASE_SERVICE_ROLE_KEY to hosted Edge Functions.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = [
  "https://mowgo.pages.dev",
  "https://mowgo.app",
  "http://localhost:5173",
];

function originHeaders(origin: string | null) {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
  };
}

const tierToEnvKey: Record<string, string> = {
  solo: "STRIPE_PRICE_SOLO",
  crew: "STRIPE_PRICE_CREW",
};

serve(async (req) => {
  const origin = req.headers.get("origin");
  const cors = originHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );
    const adminSupabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    let { tier } = await req.json();
    // "free" plan users upgrade to Solo
    if (tier === "free") tier = "solo";

    if (!tier || !tierToEnvKey[tier]) {
      return new Response(
        JSON.stringify({ error: "tier must be 'solo' or 'crew'" }),
        {
          status: 400,
          headers: { ...cors, "Content-Type": "application/json" },
        }
      );
    }

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const priceId = Deno.env.get(tierToEnvKey[tier]);

    if (!stripeKey || !priceId) {
      return new Response(
        JSON.stringify({ error: "Stripe not fully configured" }),
        {
          status: 500,
          headers: { ...cors, "Content-Type": "application/json" },
        }
      );
    }

    // Look up or create Stripe customer
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("stripe_customer_id")
      .eq("id", user.id)
      .single();

    if (profileError) {
      console.error("Profile query failed:", profileError.message ?? profileError);
      return new Response(
        JSON.stringify({ error: "Could not load user profile" }),
        {
          status: 500,
          headers: { ...cors, "Content-Type": "application/json" },
        }
      );
    }

    let customerId = profile?.stripe_customer_id;

    if (!customerId) {
      // Create a new Stripe customer
      const custResp = await fetch("https://api.stripe.com/v1/customers", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${stripeKey}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          email: user.email ?? "",
          "metadata[supabase_user_id]": user.id,
        }).toString(),
      });
      if (!custResp.ok) {
        const errBody = await custResp.text();
        let stripeMsg = "Could not create customer";
        try {
          const parsed = JSON.parse(errBody);
          stripeMsg = parsed.error?.message ?? parsed.error ?? stripeMsg;
        } catch { /* errBody was not JSON — keep default */ }
        console.error("Stripe customer creation failed:", errBody);
        return new Response(
          JSON.stringify({ error: "Could not create customer" }),
          {
            status: 502,
            headers: { ...cors, "Content-Type": "application/json" },
          }
        );
      }

      const customer = await custResp.json();
      customerId = customer.id;

      // Save the customer ID to the profile
      // This is trusted server-side billing state. Persist it with the service
      // role instead of depending on an end-user UPDATE grant for this column.
      const { error: customerSaveError } = await adminSupabase
        .from("profiles")
        .update({ stripe_customer_id: customerId })
        .eq("id", user.id);
      if (customerSaveError) {
        console.error("Failed to save Stripe customer ID:", customerSaveError);
        return new Response(
          JSON.stringify({ error: "Could not save customer" }),
          {
            status: 500,
            headers: { ...cors, "Content-Type": "application/json" },
          }
        );
      }
    }

    // Create Checkout Session
    const trialDays = Number.parseInt(Deno.env.get("STRIPE_TRIAL_DAYS") ?? "14", 10) || 14;
    const sessionResp = await fetch(
      "https://api.stripe.com/v1/checkout/sessions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${stripeKey}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          customer: customerId,
          mode: "subscription",
          "line_items[0][price]": priceId,
          "line_items[0][quantity]": "1",
          success_url: "mowgo://settings?upgraded=true",
          cancel_url: "https://mowgo.app/settings",
          "metadata[user_id]": user.id,
          "metadata[tier]": tier,
          "subscription_data[trial_period_days]": String(trialDays),
          "subscription_data[metadata][user_id]": user.id,
          "subscription_data[metadata][tier]": tier,
        }).toString(),
      }
    );

    if (!sessionResp.ok) {
      const errBody = await sessionResp.text();
      let stripeMsg = "Could not create checkout session";
      try {
        const parsed = JSON.parse(errBody);
        stripeMsg = parsed.error?.message ?? parsed.error ?? stripeMsg;
      } catch { /* errBody was not JSON — keep default */ }
      console.error("Stripe checkout error:", errBody);
      return new Response(
        JSON.stringify({ error: "Could not create checkout session" }),
        {
          status: 502,
          headers: { ...cors, "Content-Type": "application/json" },
        }
      );
    }

    const session = await sessionResp.json();

    return new Response(JSON.stringify({ url: session.url }), {
      status: 200,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("create-checkout-session error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
