// Supabase Edge Function: create-payment-intent
// Creates a Stripe PaymentIntent for invoice payments.
//
// Deploy: supabase functions deploy create-payment-intent
//
// Required env vars:
//   STRIPE_SECRET_KEY — your Stripe secret key (sk_live_... or sk_test_...)

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
    // Verify authentication
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

    const { amount, currency = "usd", invoice_id } = await req.json();

    if (!amount || !invoice_id) {
      return new Response(
        JSON.stringify({ error: "amount and invoice_id required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Verify the invoice belongs to this user
    const { data: invoice, error: invErr } = await supabase
      .from("invoices")
      .select("id, user_id")
      .eq("id", invoice_id)
      .eq("user_id", user.id)
      .single();

    if (invErr || !invoice) {
      return new Response(JSON.stringify({ error: "Invoice not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create PaymentIntent via Stripe API
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      return new Response(
        JSON.stringify({ error: "STRIPE_SECRET_KEY not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const resp = await fetch("https://api.stripe.com/v1/payment_intents", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        amount: String(amount),
        currency,
        "metadata[invoice_id]": invoice_id,
        "metadata[user_id]": user.id,
        automatic_payment_methods: "enabled",
      }).toString(),
    });

    if (!resp.ok) {
      const err = await resp.text();
      console.error("Stripe error:", err);
      return new Response(
        JSON.stringify({ error: "Payment creation failed" }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const paymentIntent = await resp.json();

    // Store the payment intent ID on the invoice
    await supabase
      .from("invoices")
      .update({ stripe_payment_intent_id: paymentIntent.id })
      .eq("id", invoice_id);

    return new Response(
      JSON.stringify({ client_secret: paymentIntent.client_secret }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("create-payment-intent error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
