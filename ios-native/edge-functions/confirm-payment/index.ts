// Supabase Edge Function: confirm-payment
// Marks an invoice as paid after successful Stripe payment.
//
// Deploy: supabase functions deploy confirm-payment
//
// Required env vars:
//   STRIPE_SECRET_KEY — to verify the PaymentIntent

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

    const { invoice_id, payment_intent_id } = await req.json();

    if (!invoice_id || !payment_intent_id) {
      return new Response(
        JSON.stringify({ error: "invoice_id and payment_intent_id required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .select("id, user_id, amount, status, stripe_payment_intent_id")
      .eq("id", invoice_id)
      .eq("user_id", user.id)
      .single();

    if (invoiceError || !invoice) {
      return new Response(JSON.stringify({ error: "Invoice not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (
      invoice.stripe_payment_intent_id &&
      invoice.stripe_payment_intent_id !== payment_intent_id
    ) {
      return new Response(JSON.stringify({ error: "Payment intent mismatch" }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (
      invoice.status === "paid" &&
      invoice.stripe_payment_intent_id === payment_intent_id
    ) {
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify the payment intent succeeded via Stripe
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      return new Response(
        JSON.stringify({ error: "Payment verification unavailable" }),
        {
          status: 503,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const resp = await fetch(
      `https://api.stripe.com/v1/payment_intents/${payment_intent_id}`,
      { headers: { Authorization: `Bearer ${stripeKey}` } }
    );
    if (!resp.ok) {
      return new Response(JSON.stringify({ error: "Payment verification failed" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const pi = await resp.json();
    if (pi.status !== "succeeded") {
      return new Response(
        JSON.stringify({
          error: `Payment not yet complete (status: ${pi.status})`,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
    if (
      pi.metadata?.invoice_id !== invoice_id ||
      pi.metadata?.user_id !== user.id
    ) {
      return new Response(JSON.stringify({ error: "Payment metadata mismatch" }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const expectedAmount = amountToCents(invoice.amount);
    if (expectedAmount === null || pi.amount_received !== expectedAmount) {
      return new Response(JSON.stringify({ error: "Payment amount mismatch" }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update invoice status
    const { data: updatedInvoice, error: updateErr } = await supabase
      .from("invoices")
      .update({
        status: "paid",
        paid_at: new Date().toISOString(),
        stripe_payment_intent_id: payment_intent_id,
      })
      .eq("id", invoice_id)
      .eq("user_id", user.id)
      .eq("stripe_payment_intent_id", payment_intent_id)
      .select("id")
      .maybeSingle();

    if (updateErr || !updatedInvoice) {
      console.error("Update error:", updateErr);
      return new Response(
        JSON.stringify({
          error: updateErr
            ? "Failed to update invoice"
            : "Invoice changed before payment could be confirmed",
        }),
        {
          status: updateErr ? 500 : 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("confirm-payment error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
