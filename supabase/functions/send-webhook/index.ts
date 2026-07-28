// Supabase Edge Function: send-webhook
// Receives event payloads and POSTs them to configured Zapier webhook URLs.
//
// Deploy: supabase functions deploy send-webhook
//
// Called by:
//   - Database triggers (via fire_webhook helper function)
//   - Frontend directly (for rain.delay.applied, payment.failed)
//
// Request body:
//   { user_id: string, event: string, payload: object }

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
    const body = await req.json();
    const { user_id, event, payload } = body;

    if (!user_id || !event) {
      return new Response(
        JSON.stringify({ error: "user_id and event are required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Use service role to query webhook_configs (RLS bypassed)
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SB_SERVICE_ROLE_KEY") ?? ""
    );

    // Fetch active webhook configs for this user that listen to this event
    const { data: configs, error: configError } = await supabase
      .from("webhook_configs")
      .select("id, zapier_url, events")
      .eq("user_id", user_id)
      .eq("is_active", true);

    if (configError) {
      console.error("Error fetching webhook configs:", configError);
      return new Response(
        JSON.stringify({ error: "Failed to load webhook configs" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!configs || configs.length === 0) {
      return new Response(JSON.stringify({ sent: 0, message: "No active webhooks configured" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Filter to configs that have this event enabled
    const matchingConfigs = configs.filter((c) =>
      Array.isArray(c.events) && c.events.includes(event)
    );

    if (matchingConfigs.length === 0) {
      return new Response(
        JSON.stringify({ sent: 0, message: "No webhooks configured for this event" }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Fire webhooks in parallel
    const webhookBody = {
      event,
      timestamp: new Date().toISOString(),
      data: payload || {},
    };

    const results = await Promise.allSettled(
      matchingConfigs.map(async (config) => {
        const resp = await fetch(config.zapier_url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(webhookBody),
          signal: AbortSignal.timeout(10_000), // 10s timeout
        });

        if (!resp.ok) {
          const errText = await resp.text().catch(() => "unknown");
          console.error(
            `Webhook failed for config ${config.id}: ${resp.status} ${errText}`
          );
          throw new Error(`HTTP ${resp.status}`);
        }

        return { config_id: config.id, status: resp.status };
      })
    );

    const sent = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;

    return new Response(
      JSON.stringify({ sent, failed, total: matchingConfigs.length }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("send-webhook error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
