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

function amountToCents(value: unknown): number | null {
  const match = String(value).match(/^(\d+)(?:\.(\d{1,2}))?$/);
  if (!match) return null;
  const cents = Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
  return Number.isSafeInteger(cents) && cents > 0 ? cents : null;
}

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

    const { currency = "usd", invoice_id } = await req.json();

    if (!invoice_id) {
      return new Response(
        JSON.stringify({ error: "invoice_id required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Verify the invoice belongs to this user
    const { data: invoice, error: invErr } = await supabase
      .from("invoices")
      .select("id, user_id, amount, status, stripe_payment_intent_id")
      .eq("id", invoice_id)
      .eq("user_id", user.id)
      .single();

    if (invErr || !invoice) {
      return new Response(JSON.stringify({ error: "Invoice not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (invoice.status === "paid") {
      return new Response(JSON.stringify({ error: "Invoice is already paid" }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const amount = amountToCents(invoice.amount);
    if (amount === null) {
      return new Response(JSON.stringify({ error: "Invalid invoice amount" }), {
        status: 422,
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
        "Idempotency-Key": `mowgo-invoice-${user.id}-${invoice_id}-${Date.now()}`,
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
      // Truncate the Stripe error so we avoid leaking secrets but still get
      // actionable diagnostics in the client-facing message.
      const detail = (err || "").slice(0, 200);
      return new Response(
        JSON.stringify({ error: "Payment creation failed", detail }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const paymentIntent = await resp.json();

    // Store the payment intent ID on the invoice
    const { data: savedInvoice, error: saveErr } = await supabase
      .from("invoices")
      .update({ stripe_payment_intent_id: paymentIntent.id })
      .eq("id", invoice_id)
      .eq("user_id", user.id)
      .select("id")
      .maybeSingle();

    if (saveErr || !savedInvoice) {
      console.error("Failed to save payment intent ID:", saveErr);
      return new Response(
        JSON.stringify({ error: "Failed to save payment intent" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        client_secret: paymentIntent.client_secret,
        payment_intent_id: paymentIntent.id,
      }),
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
