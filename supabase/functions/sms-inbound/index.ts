// Supabase Edge Function: sms-inbound
// Twilio webhook for inbound SMS on the shared MowGo number.
//
// Deploy (MUST skip JWT verification — Twilio has no JWT):
//   supabase functions deploy sms-inbound --no-verify-jwt
//
// Twilio: Messaging -> number -> "A message comes in" webhook:
//   https://<project-ref>.supabase.co/functions/v1/sms-inbound  (POST)
//
// Routing (seamless pro <-> client):
//   - Client texts the MowGo number  -> forwarded to the owner's phone (profiles.phone)
//     as "{Client first name}: {body}"
//   - Owner replies to the MowGo number -> routed to the owner's MOST RECENT thread's
//     client phone, body as-is (MVP rule; documented limitation)
//   - Unknown sender / no thread -> 200 silent (log only)
//
// Security: validates X-Twilio-Signature (HMAC-SHA1 over URL + sorted body params)
// BEFORE any routing or forwarding.
//
// Required Supabase secrets:
//   TWILIO_AUTH_TOKEN, TWILIO_ACCOUNT_SID, TWILIO_FROM

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
): Promise<boolean> {
  try {
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
    if (!resp.ok) {
      const detail = await resp.text().catch(() => "");
      console.error(`sms-inbound forward failed (${resp.status}):`, detail.slice(0, 300));
    }
    return resp.ok;
  } catch (error) {
    console.error("sms-inbound forward error:", error instanceof Error ? error.message : String(error));
    return false;
  }
}

/**
 * Validate Twilio's X-Twilio-Signature header.
 * Signature = base64(HMAC-SHA1(authToken, requestUrl + sortedBodyParams)).
 * The URL must be reconstructed from the request (Twilio signs what it sent).
 */
async function isValidTwilioRequest(
  req: Request,
  authToken: string,
  bodyParams: URLSearchParams,
): Promise<boolean> {
  const signature = req.headers.get("x-twilio-signature");
  if (!signature || !authToken) return false;

  const url = req.url;
  const sorted = [...bodyParams.entries()].sort((a, b) =>
    a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0
  );
  const payload = url + sorted.map(([k, v]) => k + v).join("");

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(authToken),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  const expected = btoa(String.fromCharCode(...new Uint8Array(mac)));

  // Constant-time comparison.
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return diff === 0;
}

function firstName(name: string): string {
  const trimmed = (name || "").trim();
  return (trimmed.split(/\s+/)[0] || trimmed).slice(0, 15);
}

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const ENV = Deno.env.toObject();
    const authToken = ENV.TWILIO_AUTH_TOKEN ?? "";
    if (!authToken || !ENV.TWILIO_ACCOUNT_SID || !ENV.TWILIO_FROM) {
      console.error("sms-inbound: missing Twilio secrets");
      return new Response("Misconfigured", { status: 500 });
    }

    const form = await req.formData();
    const bodyParams = new URLSearchParams();
    for (const [k, v] of form.entries()) {
      if (typeof v === "string") bodyParams.append(k, v);
    }

    if (!(await isValidTwilioRequest(req, authToken, bodyParams))) {
      console.warn("sms-inbound: invalid Twilio signature");
      return new Response("Forbidden", { status: 403 });
    }

    const from = (bodyParams.get("From") ?? "").trim();
    const text = (bodyParams.get("Body") ?? "").trim();

    if (!from || !text) {
      return new Response("OK", { status: 200 });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SB_SERVICE_ROLE_KEY") ?? "",
    );

    // ---- Case 1: the OWNER is replying ----
    // Match on the raw inbound number or its normalized form (owners may have
    // saved their phone in any US format). Note: no unique constraint on
    // profiles.phone — take the first match and log if ambiguous.
    const fromNorm = normalizePhone(from) ?? from;
    const { data: owners, error: ownerLookupError } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .in("phone", [from, fromNorm]);

    if (ownerLookupError) {
      console.error("sms-inbound owner lookup error:", ownerLookupError.message);
    } else if (owners && owners.length > 0) {
      const owner = owners[0];
      if (owners.length > 1) {
        console.warn(`sms-inbound: ${owners.length} profiles match phone ${from}; using first`);
      }
      // Already scoped to this owner's OWN business (user_id = owner.id is
      // the business_id) — no cross-tenant risk here regardless of which
      // thread is "most recent"; the ambiguity risk in this path is entirely
      // in picking `owner` above when multiple profiles share a phone.
      const { data: thread } = await supabaseAdmin
        .from("sms_threads")
        .select("id, client_phone")
        .eq("user_id", owner.id)
        .order("last_activity", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (thread?.client_phone) {
        // Update recency ONLY after a successful forward (a failed forward must
        // not become the "most recent" conversation and misroute later replies).
        const ok = await sendTwilio(ENV, thread.client_phone, text);
        if (ok) {
          await supabaseAdmin
            .from("sms_threads")
            .update({ last_activity: new Date().toISOString(), last_from: "owner" })
            .eq("id", thread.id);
        }
      } else {
        console.info(`sms-inbound: owner ${owner.id} replied with no thread`);
      }
      return new Response("OK", { status: 200 });
    }

    // ---- Case 2: a CLIENT is texting ----
    // Threads are written with E.164 client_phone, so the raw inbound From matches.
    //
    // Cross-tenant guard: a phone number can have an sms_threads row under
    // MORE THAN ONE business (e.g. a homeowner who is a client of two
    // different lawn businesses, or a reused/ported number). Picking the
    // globally most-recent thread by client_phone alone could forward a
    // client's message to the WRONG owner. Narrow candidates to businesses
    // that actually have a `clients` row for this phone number first; only
    // fall back to the unscoped global lookup if none do.
    //
    // clients.phone is stored in whatever format the owner typed it in (not
    // normalized), so match both the raw inbound number and its E.164 form —
    // same two-variant approach as the owner-phone lookup above.
    const { data: matchingClients, error: clientLookupError } = await supabaseAdmin
      .from("clients")
      .select("user_id")
      .in("phone", [from, fromNorm]);

    if (clientLookupError) {
      console.error("sms-inbound client lookup error:", clientLookupError.message);
    }

    const candidateBusinessIds = [
      ...new Set((matchingClients ?? []).map((c) => c.user_id).filter(Boolean)),
    ];

    let thread: { id: string; user_id: string; client_id: string | null; client_phone: string } | null = null;
    let threadError: { message: string } | null = null;

    if (candidateBusinessIds.length > 0) {
      const res = await supabaseAdmin
        .from("sms_threads")
        .select("id, user_id, client_id, client_phone")
        .eq("client_phone", from)
        .in("user_id", candidateBusinessIds)
        .order("last_activity", { ascending: false })
        .limit(1)
        .maybeSingle();
      thread = res.data;
      threadError = res.error;
    }

    if (!thread && !threadError) {
      // No clients-table match (client record deleted, or the number was
      // never saved) — fall back to the most-recent thread for this phone
      // across ALL businesses. Documented limitation: this can still
      // cross tenants if the same phone texted more than one business and
      // neither has a surviving clients row. Logged so it's visible, not
      // silent.
      console.warn(`sms-inbound: no clients-table match for ${from}; falling back to most-recent thread across all businesses`);
      const res = await supabaseAdmin
        .from("sms_threads")
        .select("id, user_id, client_id, client_phone")
        .eq("client_phone", from)
        .order("last_activity", { ascending: false })
        .limit(1)
        .maybeSingle();
      thread = res.data;
      threadError = res.error;
    }

    if (threadError) {
      console.error("sms-inbound thread lookup error:", threadError.message);
    } else if (thread) {
      const { data: ownerProfile } = await supabaseAdmin
        .from("profiles")
        .select("phone")
        .eq("id", thread.user_id)
        .maybeSingle();

      const ownerPhone = normalizePhone(ownerProfile?.phone);
      if (ownerPhone) {
        const { data: client } = await supabaseAdmin
          .from("clients")
          .select("name")
          .eq("id", thread.client_id ?? "")
          .maybeSingle();
        const label = firstName(client?.name ?? "");
        const forwarded = label ? `${label}: ${text}` : text;
        const ok = await sendTwilio(ENV, ownerPhone, forwarded);
        if (ok) {
          await supabaseAdmin
            .from("sms_threads")
            .update({ last_activity: new Date().toISOString(), last_from: "client" })
            .eq("id", thread.id);
        }
      } else {
        console.info(`sms-inbound: thread ${thread.id} owner has no valid phone`);
      }
    } else {
      // A client number can exist in threads for more than one business (shared
      // number). MVP routes to the globally most recent thread; documented limitation.
      console.info(`sms-inbound: no thread for ${from}`);
    }

    return new Response("OK", { status: 200 });
  } catch (err) {
    console.error("sms-inbound error:", err);
    return new Response("Internal error", { status: 500 });
  }
});
