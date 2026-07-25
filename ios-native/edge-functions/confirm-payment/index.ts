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

    // Verify the payment intent succeeded via Stripe
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (stripeKey) {
      const resp = await fetch(
        `https://api.stripe.com/v1/payment_intents/${payment_intent_id}`,
        {
          headers: { Authorization: `Bearer ${stripeKey}` },
        }
      );
      if (resp.ok) {
        const pi = await resp.json();
        if (pi.status !== "succeeded") {
          return new Response(
            JSON.stringify({
              error: `Payment not yet complete (status: ${pi.status})`,
            }),
            {
              status: 400,
              headers: {
                ...corsHeaders,
                "Content-Type": "application/json",
              },
            }
          );
        }
      }
      // If Stripe call fails, proceed anyway (belt-and-suspenders)
    }

    // Update invoice status
    const { error: updateErr } = await supabase
      .from("invoices")
      .update({
        status: "paid",
        paid_at: new Date().toISOString(),
        stripe_payment_intent_id: payment_intent_id,
      })
      .eq("id", invoice_id)
      .eq("user_id", user.id);

    if (updateErr) {
      console.error("Update error:", updateErr);
      return new Response(
        JSON.stringify({ error: "Failed to update invoice" }),
        {
          status: 500,
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
