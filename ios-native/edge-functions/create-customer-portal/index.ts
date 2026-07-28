// Supabase Edge Function: create-customer-portal
// Creates a Stripe Customer Portal session so users can manage/cancel subscriptions.
//
// Deploy: supabase functions deploy create-customer-portal
//
// Required env vars:
//   STRIPE_SECRET_KEY — your Stripe secret key
//   STRIPE_PORTAL_RETURN_URL — deep link to return to app (default: mowgo://settings?portal_returned=true)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Look up the user's Stripe customer ID
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("stripe_customer_id")
      .eq("id", user.id)
      .single();

    if (profileError || !profile?.stripe_customer_id) {
      return new Response(
        JSON.stringify({ error: "No Stripe customer found. Subscribe first." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      return new Response(
        JSON.stringify({ error: "Stripe not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const customerId = profile.stripe_customer_id;
    const returnUrl =
      Deno.env.get("STRIPE_PORTAL_RETURN_URL") ??
      "mowgo://settings?portal_returned=true";

    // Create a Stripe Billing Portal session
    const portalResp = await fetch(
      "https://api.stripe.com/v1/billing_portal/sessions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${stripeKey}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          customer: customerId,
          return_url: returnUrl,
        }).toString(),
      }
    );

    if (!portalResp.ok) {
      const errBody = await portalResp.text();
      let stripeMsg = "Could not create portal session";
      try {
        const parsed = JSON.parse(errBody);
        stripeMsg = parsed.error?.message ?? stripeMsg;
      } catch { /* keep default */ }
      console.error("Stripe portal error:", errBody);
      return new Response(
        JSON.stringify({ error: stripeMsg }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const portal = await portalResp.json();

    return new Response(JSON.stringify({ url: portal.url }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("create-customer-portal error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
