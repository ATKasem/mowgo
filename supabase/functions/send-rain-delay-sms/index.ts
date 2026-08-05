// Supabase Edge Function: send-rain-delay-sms
// Sends rain-delay reschedule SMS to affected clients via Twilio.
//
// Deploy: supabase functions deploy send-rain-delay-sms
//
// Called by the app (web/iOS) AFTER jobs are moved, fire-and-forget.
// JWT-protected: the caller must be the authenticated owner of the jobs.
//
// Request body:
//   { jobIds: string[], targetDate: 'YYYY-MM-DD' }
//
// Required Supabase secrets:
//   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = [
  "https://mowgo.pages.dev",
  "https://mowgoapp.com",
  "https://mowgo.app",
  "http://localhost:5173",
];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Abuse guard: at most N rain-delay batches per user per window (per-isolate, best effort).
const BATCH_WINDOW_MS = 15 * 60 * 1000;
const BATCH_LIMIT = 3;
const MAX_JOBS_PER_BATCH = 50;
const MAX_CONCURRENT_SENDS = 5;
const batchAttempts = new Map<string, { count: number; reset: number }>();

function batchAllowed(userId: string): boolean {
  const now = Date.now();
  const entry = batchAttempts.get(userId);
  if (!entry || now >= entry.reset) {
    batchAttempts.set(userId, { count: 1, reset: now + BATCH_WINDOW_MS });
    return true;
  }
  if (entry.count >= BATCH_LIMIT) return false;
  entry.count += 1;
  return true;
}

function originHeaders(origin: string | null) {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
  };
}

/** Normalize a US phone to E.164 (+1XXXXXXXXXX), or null if not a valid US number. */
export function normalizePhone(raw: string | null | undefined): string | null {
  const digits = (raw ?? "").replace(/\D/g, "");
  if (digits.length === 10) return "+1" + digits;
  if (digits.length === 11 && digits.startsWith("1")) return "+" + digits;
  return null;
}

function twilioAuthHeader(env: Record<string, string | undefined>): string {
  return "Basic " + btoa(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`);
}

async function sendTwilio(
  env: Record<string, string | undefined>,
  to: string,
  body: string,
): Promise<{ ok: boolean; status: number; sid?: string; error?: string }> {
  const url =
    `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`;
  const params = new URLSearchParams({ To: to, From: env.TWILIO_FROM ?? "", Body: body });
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: twilioAuthHeader(env),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params,
    signal: AbortSignal.timeout(10_000),
  });
  const data = await resp.json().catch(() => ({})) as {
    sid?: string;
    message?: string;
  };
  return {
    ok: resp.ok,
    status: resp.status,
    sid: data.sid,
    error: !resp.ok ? data.message : undefined,
  };
}

function prettyDate(targetDate: string): string {
  // Parse as UTC midnight so the day doesn't shift across timezones.
  return new Date(targetDate + "T00:00:00Z").toLocaleDateString(
    "en-US",
    { weekday: "long", month: "short", day: "numeric", timeZone: "UTC" },
  );
}

function firstName(name: string): string {
  const trimmed = (name || "").trim();
  return (trimmed.split(/\s+/)[0] || trimmed).slice(0, 15);
}

serve(async (req) => {
  const ENV = Deno.env.toObject();
  const origin = req.headers.get("origin");
  const cors = originHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Missing authorization" }),
        { status: 401, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SB_SERVICE_ROLE_KEY") ?? "",
    );

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user: caller },
      error: authError,
    } = await supabaseAdmin.auth.getUser(token);

    if (authError || !caller) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    if (!Deno.env.get("TWILIO_ACCOUNT_SID") || !Deno.env.get("TWILIO_AUTH_TOKEN") || !Deno.env.get("TWILIO_FROM")) {
      return new Response(
        JSON.stringify({ error: "SMS is not configured." }),
        { status: 503, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    const body = await req.json();
    const jobIds: unknown = body?.jobIds;
    const targetDate: unknown = body?.targetDate;

    if (
      !Array.isArray(jobIds) ||
      jobIds.length === 0 ||
      jobIds.length > MAX_JOBS_PER_BATCH ||
      !jobIds.every((id) => typeof id === "string" && UUID_RE.test(id))
    ) {
      return new Response(
        JSON.stringify({ error: `jobIds must be 1-${MAX_JOBS_PER_BATCH} job UUIDs` }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }
    if (typeof targetDate !== "string" || !DATE_RE.test(targetDate)) {
      return new Response(
        JSON.stringify({ error: "targetDate must be YYYY-MM-DD" }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    if (!batchAllowed(caller.id)) {
      return new Response(
        JSON.stringify({ error: "Too many rain-delay SMS batches. Please try again later." }),
        { status: 429, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("business_name")
      .eq("id", caller.id)
      .maybeSingle();

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: "Profile not found" }),
        { status: 404, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    // Only the caller's own jobs — and only jobs actually moved to targetDate.
    const { data: jobs, error: jobsError } = await supabaseAdmin
      .from("jobs")
      .select("id, client_id")
      .in("id", jobIds)
      .eq("user_id", caller.id)
      .eq("scheduled_date", targetDate);

    if (jobsError || !jobs || jobs.length === 0) {
      return new Response(
        JSON.stringify({ error: "No matching jobs on the target date" }),
        { status: 404, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    const clientIds = [...new Set(jobs.map((j) => j.client_id).filter(Boolean))];
    const { data: clients, error: clientsError } = await supabaseAdmin
      .from("clients")
      .select("id, name, phone")
      .in("id", clientIds)
      .eq("user_id", caller.id);

    if (clientsError) {
      return new Response(
        JSON.stringify({ error: "Could not load clients" }),
        { status: 500, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    const business = (profile.business_name?.trim() || "Your lawn care team").slice(0, 30);
    const pretty = prettyDate(targetDate);
    const now = new Date().toISOString();

    const sent: string[] = [];
    const skipped: string[] = [];
    const errors: { clientId: string; error: string }[] = [];

    const recipients: { client: { id: string; name: string }; phone: string }[] = [];
    for (const client of clients ?? []) {
      const phone = normalizePhone(client.phone);
      if (!phone) {
        skipped.push(client.id);
        continue;
      }
      recipients.push({ client: { id: client.id, name: client.name }, phone });
    }

    // Bounded concurrency: send in chunks of MAX_CONCURRENT_SENDS.
    for (let i = 0; i < recipients.length; i += MAX_CONCURRENT_SENDS) {
      const chunk = recipients.slice(i, i + MAX_CONCURRENT_SENDS);
      const results = await Promise.all(
        chunk.map(async ({ client, phone }) => {
          const message =
            `Hi ${firstName(client.name)}, this is ${business}. Rain's coming, so we moved your service to ${pretty}. No action needed.`;
          const result = await sendTwilio(ENV, phone, message);
          if (result.ok) {
            const { error: upsertError } = await supabaseAdmin
              .from("sms_threads")
              .upsert(
                {
                  user_id: caller.id,
                  client_id: client.id,
                  client_phone: phone,
                  last_activity: now,
                  last_from: "client",
                },
                { onConflict: "user_id,client_id" },
              );
            if (upsertError) {
              return { ok: false, clientId: client.id, error: `SMS sent but thread not saved: ${upsertError.message}` };
            }
            return { ok: true, clientId: client.id };
          }
          return { ok: false, clientId: client.id, error: result.error || `HTTP ${result.status}` };
        }),
      );
      for (const r of results) {
        if (r.ok) sent.push(r.clientId);
        else errors.push({ clientId: r.clientId, error: r.error ?? "unknown" });
      }
    }

    return new Response(
      JSON.stringify({
        sent: sent.length,
        skipped: skipped.length,
        errors,
      }),
      { status: 200, headers: { ...cors, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("send-rain-delay-sms error:", err);
    return new Response(
      JSON.stringify({ error: "Internal error" }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }
});
