// Supabase Edge Function: send-job-complete-sms
// Notifies a client via Twilio after their job is marked complete.
//
// Deploy: supabase functions deploy send-job-complete-sms
//
// Called by the app after a job is completed, fire-and-forget.
// JWT-protected: the caller must own the completed job.
//
// Request body:
//   { jobId: string }
//
// Required Supabase secrets:
//   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = [
  "https://mowgoapp.com",
  "http://localhost:5173",
];

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Abuse guard: at most N completion SMS attempts per user per window
// (per-isolate, best effort).
const SEND_WINDOW_MS = 15 * 60 * 1000;
const SEND_LIMIT = 50;
const sendAttempts = new Map<string, { count: number; reset: number }>();

function sendAllowed(userId: string): boolean {
  const now = Date.now();
  const entry = sendAttempts.get(userId);
  if (!entry || now >= entry.reset) {
    sendAttempts.set(userId, { count: 1, reset: now + SEND_WINDOW_MS });
    return true;
  }
  if (entry.count >= SEND_LIMIT) return false;
  entry.count += 1;
  return true;
}

function originHeaders(origin: string | null) {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin)
    ? origin
    : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
  };
}

function normalizePhone(raw: string | null | undefined): string | null {
  const digits = (raw ?? "").replace(/\D/g, "");
  if (digits.length === 10) return "+1" + digits;
  if (digits.length === 11 && digits.startsWith("1")) return "+" + digits;
  return null;
}

function jsonResponse(
  body: Record<string, unknown>,
  status: number,
  cors: Record<string, string>,
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  const origin = req.headers.get("origin");
  const cors = originHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SB_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      console.error(
        "send-job-complete-sms: Supabase service credentials not configured",
      );
      return jsonResponse({ error: "Service not configured" }, 503, cors);
    }

    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Missing authorization" }, 401, cors);
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user: caller },
      error: authError,
    } = await supabaseAdmin.auth.getUser(token);

    if (authError || !caller) {
      return jsonResponse({ error: "Invalid token" }, 401, cors);
    }

    const env = Deno.env.toObject();
    if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN || !env.TWILIO_FROM) {
      return jsonResponse({ error: "SMS is not configured." }, 503, cors);
    }

    const body = await req.json();
    const jobId: unknown = body?.jobId;
    if (typeof jobId !== "string" || !UUID_RE.test(jobId)) {
      return jsonResponse({ error: "jobId must be a UUID" }, 400, cors);
    }

    if (!sendAllowed(caller.id)) {
      return jsonResponse(
        { error: "Too many completion SMS attempts. Please try again later." },
        429,
        cors,
      );
    }

    const { data: job, error: jobError } = await supabaseAdmin
      .from("jobs")
      .select("id, client_id")
      .eq("id", jobId)
      .eq("user_id", caller.id)
      .eq("status", "done")
      .maybeSingle();

    if (jobError || !job?.client_id) {
      return jsonResponse({ error: "Completed job not found" }, 404, cors);
    }

    const { data: client, error: clientError } = await supabaseAdmin
      .from("clients")
      .select("id, phone")
      .eq("id", job.client_id)
      .eq("user_id", caller.id)
      .maybeSingle();

    if (clientError || !client) {
      return jsonResponse({ error: "Client not found" }, 404, cors);
    }

    const phone = normalizePhone(client.phone);
    if (!phone) {
      return jsonResponse(
        { error: "Client does not have a valid phone number" },
        422,
        cors,
      );
    }

    const twilioUrl =
      `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`;
    const params = new URLSearchParams({
      To: phone,
      From: env.TWILIO_FROM,
      Body: "Your lawn service was completed today! - MowGo",
    });
    const twilioResponse = await fetch(twilioUrl, {
      method: "POST",
      headers: {
        Authorization: "Basic " +
          btoa(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params,
      signal: AbortSignal.timeout(10_000),
    });
    const twilioData = await twilioResponse.json().catch(() => ({})) as {
      sid?: string;
      message?: string;
    };

    if (!twilioResponse.ok) {
      console.error(
        "send-job-complete-sms: Twilio request failed",
        twilioResponse.status,
      );
      return jsonResponse(
        { error: twilioData.message ?? `Twilio HTTP ${twilioResponse.status}` },
        502,
        cors,
      );
    }

    const { error: upsertError } = await supabaseAdmin
      .from("sms_threads")
      .upsert(
        {
          user_id: caller.id,
          client_id: client.id,
          client_phone: phone,
          last_activity: new Date().toISOString(),
          last_from: "client",
        },
        { onConflict: "user_id,client_id" },
      );
    if (upsertError) {
      console.error(
        "send-job-complete-sms: SMS sent but thread not saved",
        upsertError.message,
      );
    }

    return jsonResponse({ sent: true, sid: twilioData.sid }, 200, cors);
  } catch (err) {
    console.error("send-job-complete-sms error:", err);
    return jsonResponse({ error: "Internal error" }, 500, cors);
  }
});
