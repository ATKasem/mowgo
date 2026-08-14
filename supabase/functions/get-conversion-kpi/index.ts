// Supabase Edge Function: get-conversion-kpi
// Read-only Free→Paid conversion KPI for the AdminConcierge admin page.
//
// Deploy: supabase functions deploy get-conversion-kpi
//
// Auth: same layered operator auth as functions/api/admin/concierge.js
// (shared code + Supabase bearer token + allowlisted user ID). Set via:
//   supabase secrets set CONCIERGE_ADMIN_CODE=<same value as the CF Pages env var>
//
// Required env vars:
//   CONCIERGE_ADMIN_CODE       — shared admin secret (same value as CF Pages)
//   CONCIERGE_ADMIN_USER_IDS   — comma-separated Supabase user UUIDs
// Supabase automatically provides SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = [
  "https://mowgoapp.com",
  "http://localhost:5173",
];

function originHeaders(origin: string | null) {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-admin-code",
  };
}

// Same technique as functions/api/admin/concierge.js's timingSafeEqual —
// avoid leaking the admin code length/content via response-time differences.
function timingSafeEqual(left: string, right: string) {
  const a = String(left || "");
  const b = String(right || "");
  let diff = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let i = 0; i < length; i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

serve(async (req) => {
  const origin = req.headers.get("origin");
  const cors = originHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  const adminCode = Deno.env.get("CONCIERGE_ADMIN_CODE");
  const providedCode = req.headers.get("x-admin-code") ?? "";
  if (!adminCode || !timingSafeEqual(providedCode, adminCode)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );
    const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
    const allowedIds = (Deno.env.get("CONCIERGE_ADMIN_USER_IDS") ?? "").split(",").map(value => value.trim()).filter(Boolean);
    const { data: { user }, error: userError } = await admin.auth.getUser(token);
    if (!token || userError || !user || !allowedIds.includes(user.id)) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // All four metrics are computed in a single SQL aggregate (RPC
    // get_conversion_kpi, supabase/migrations/20260808120000_conversion_kpi_rpc.sql)
    // rather than fetched as rows and counted in JS:
    //  - profiles.trial_started_at is NOT a reliable trial cohort: the
    //    Stripe webhook (functions/api/stripe/webhook.js updateProfile)
    //    nulls trial_tier/trial_started_at/trial_ends_at on ANY paid
    //    subscription event, so converted users vanish from that column.
    //    tier_events(source='trial_grant') is the immutable cohort instead.
    //  - "converted" also has to catch a trial user who bought the SAME
    //    tier they were trialing on — the webhook only logs a tier_events
    //    row when the tier actually changes, so that case needs a fallback
    //    to profiles.tier / stripe_customer_id.
    //  - PostgREST caps unbounded .select() results at ~1000 rows, which
    //    would silently truncate these counts as the platform grows.
    const { data: kpiRows, error: kpiError } = await admin.rpc("get_conversion_kpi");
    if (kpiError) throw kpiError;
    const kpi = Array.isArray(kpiRows) ? kpiRows[0] : kpiRows;

    const totalSignups = Number(kpi?.total_signups ?? 0);
    const trialsStarted = Number(kpi?.trials_started ?? 0);
    const trialsStartedLast30Days = Number(kpi?.trials_started_last_30_days ?? 0);
    const trialsConverted = Number(kpi?.trials_converted ?? 0);

    const conversionPct = trialsStarted > 0
      ? Math.round((trialsConverted / trialsStarted) * 1000) / 10
      : 0;

    return new Response(
      JSON.stringify({
        total_signups: totalSignups ?? 0,
        trials_started: trialsStarted,
        trials_converted: trialsConverted,
        conversion_pct: conversionPct,
        trials_started_last_30_days: trialsStartedLast30Days,
      }),
      { status: 200, headers: { ...cors, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("get-conversion-kpi error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
