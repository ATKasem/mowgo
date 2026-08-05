// Supabase Edge Function: send-push
// Sends push notifications to registered iOS (APNs) and Android (FCM) devices.
//
// Deploy: supabase functions deploy send-push
//
// Required Supabase secrets (set via Dashboard → Settings → Edge Functions):
//   APNS_KEY_ID      — 10-char key ID from Apple Developer → Keys → APNs Auth Key
//   APNS_TEAM_ID     — 10-char Team ID from Apple Developer → Membership
//   APNS_AUTH_KEY    — The .p8 file contents (full PEM string)
//   APNS_BUNDLE_ID   — iOS bundle identifier (default: com.mowgo.app)
//   FCM_SERVICE_ACCOUNT_JSON — Firebase service account JSON for FCM HTTP v1
//
// Request body:
//   { userId: string, title: string, body: string }
//
// The function looks up the user's platform tokens and routes delivery through
// APNs HTTP/2 or FCM HTTP v1 using Web Crypto for provider authentication.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = [
  "https://mowgo.pages.dev",
  "https://mowgoapp.com",
  "https://mowgo.app",
  "http://localhost:5173",
];

function originHeaders(origin: string | null) {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
  };
}

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64UrlJson(value: unknown): string {
  return base64Url(new TextEncoder().encode(JSON.stringify(value)));
}

// ---------------------------------------------------------------------------
// APNs JWT token generation
// ---------------------------------------------------------------------------

interface ApnsJwtPayload {
  alg: "ES256";
  kid: string;
}

interface ApnsJwtClaim {
  iss: string;
  iat: number;
}

/**
 * Generate an APNs authentication token using ES256 (P-256 + SHA-256).
 * Uses Web Crypto API (available in Deno) instead of jsonwebtoken package.
 */
async function generateApnsToken(): Promise<string> {
  const keyId = Deno.env.get("APNS_KEY_ID") ?? "";
  const teamId = Deno.env.get("APNS_TEAM_ID") ?? "";
  const authKeyRaw = Deno.env.get("APNS_AUTH_KEY") ?? "";

  if (!keyId || !teamId || !authKeyRaw) {
    throw new Error("Missing APNS_KEY_ID, APNS_TEAM_ID, or APNS_AUTH_KEY secrets");
  }

  // Extract the raw base64 key from PEM format
  const pemBody = authKeyRaw
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");

  const keyBytes = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));

  // Import as PKCS#8 private key for ECDSA P-256
  const privateKey = await crypto.subtle.importKey(
    "pkcs8",
    keyBytes,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );

  // Build JWT header and payload
  const header: ApnsJwtPayload = { alg: "ES256", kid: keyId };
  const claim: ApnsJwtClaim = {
    iss: teamId,
    iat: Math.floor(Date.now() / 1000),
  };

  const encoder = new TextEncoder();
  const headerB64 = btoa(JSON.stringify(header))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  const claimB64 = btoa(JSON.stringify(claim))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const signingInput = `${headerB64}.${claimB64}`;
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    privateKey,
    encoder.encode(signingInput),
  );

  // Convert raw signature (64 bytes: r + s) to DER format
  const sigBytes = new Uint8Array(signature);
  const r = sigBytes.slice(0, 32);
  const s = sigBytes.slice(32, 64);

  // Trim leading zeros
  let rStart = 0;
  while (rStart < 31 && r[rStart] === 0) rStart++;
  let sStart = 0;
  while (sStart < 31 && s[sStart] === 0) sStart++;

  const rLen = 32 - rStart;
  const sLen = 32 - sStart;

  // DER: 0x30 (sequence) + totalLen + 0x02 (integer) + rLen + r + 0x02 + sLen + s
  const totalLen = 2 + rLen + 2 + sLen;
  const der = new Uint8Array(2 + totalLen);
  der[0] = 0x30;
  der[1] = totalLen;
  der[2] = 0x02;
  der[3] = rLen;
  der.set(r.slice(rStart), 4);
  der[4 + rLen] = 0x02;
  der[5 + rLen] = sLen;
  der.set(s.slice(sStart), 6 + rLen);

  const sigB64 = btoa(String.fromCharCode(...der))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  return `${signingInput}.${sigB64}`;
}

// ---------------------------------------------------------------------------
// Send push via APNs HTTP/2
// ---------------------------------------------------------------------------

interface ApnsPayload {
  aps: {
    alert: { title: string; body: string };
    sound: string;
    "content-available"?: number;
    badge?: number;
  };
  [key: string]: unknown;
}

async function sendApnsPush(
  deviceToken: string,
  title: string,
  body: string,
): Promise<{ success: boolean; status: number; detail?: string }> {
  const bundleId = Deno.env.get("APNS_BUNDLE_ID") ?? "com.mowgo.app";
  const token = await generateApnsToken();

  // Use apns:// for production; change to apns://api.sandbox.push.apple.com for dev
  const url = `https://api.push.apple.com/3/device/${deviceToken}`;

  const payload: ApnsPayload = {
    aps: {
      alert: { title, body },
      sound: "default",
    },
  };

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "authorization": `bearer ${token}`,
      "apns-topic": bundleId,
      "apns-priority": "10",
      "apns-push-type": "alert",
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10_000),
  });

  if (!resp.ok) {
    const detail = await resp.text().catch(() => "unknown");
    console.error(`APNs push failed (${resp.status}): ${detail}`);
    return { success: false, status: resp.status, detail };
  }

  return { success: true, status: resp.status };
}

// ---------------------------------------------------------------------------
// FCM HTTP v1 OAuth and delivery
// ---------------------------------------------------------------------------

interface FcmServiceAccount {
  project_id: string;
  client_email: string;
  private_key: string;
  token_uri: string;
}

interface PushResult {
  success: boolean;
  status: number;
  detail?: string;
}

let cachedFcmAccessToken: { token: string; expiresAt: number } | null = null;

function getFcmServiceAccount(): FcmServiceAccount {
  const raw = Deno.env.get("FCM_SERVICE_ACCOUNT_JSON");
  if (!raw) throw new Error("Missing FCM_SERVICE_ACCOUNT_JSON secret");
  const account = JSON.parse(raw) as FcmServiceAccount;
  if (!account.project_id || !account.client_email || !account.private_key || !account.token_uri) {
    throw new Error("FCM_SERVICE_ACCOUNT_JSON is missing required fields");
  }
  return account;
}

async function getFcmAccessToken(account: FcmServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedFcmAccessToken && cachedFcmAccessToken.expiresAt > now + 60) {
    return cachedFcmAccessToken.token;
  }

  const pemBody = account.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");
  const keyBytes = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));
  const privateKey = await crypto.subtle.importKey(
    "pkcs8",
    keyBytes,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const expiresAt = now + 3600;
  const signingInput = `${base64UrlJson({ alg: "RS256", typ: "JWT" })}.${base64UrlJson({
    iss: account.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: account.token_uri,
    iat: now,
    exp: expiresAt,
  })}`;
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    privateKey,
    new TextEncoder().encode(signingInput),
  );
  const assertion = `${signingInput}.${base64Url(new Uint8Array(signature))}`;

  const response = await fetch(account.token_uri, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "unknown");
    throw new Error(`FCM OAuth token request failed (${response.status}): ${detail}`);
  }
  const tokenResponse = await response.json() as { access_token?: string; expires_in?: number };
  if (!tokenResponse.access_token) throw new Error("FCM OAuth response omitted access_token");
  cachedFcmAccessToken = {
    token: tokenResponse.access_token,
    expiresAt: now + (tokenResponse.expires_in ?? 3600),
  };
  return tokenResponse.access_token;
}

async function sendFcmPush(
  projectId: string,
  fcmToken: string,
  title: string,
  body: string,
): Promise<PushResult> {
  const account = getFcmServiceAccount();
  const accessToken = await getFcmAccessToken(account);
  const response = await fetch(
    `https://fcm.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/messages:send`,
    {
      method: "POST",
      headers: {
        "authorization": `Bearer ${accessToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        message: {
          token: fcmToken,
          notification: { title, body },
          android: { priority: "high" },
        },
      }),
      signal: AbortSignal.timeout(10_000),
    },
  );
  if (!response.ok) {
    const detail = await response.text().catch(() => "unknown");
    console.error(`FCM push failed (${response.status}): ${detail}`);
    return { success: false, status: response.status, detail };
  }
  return { success: true, status: response.status };
}

function isInvalidFcmToken(result: PushResult): boolean {
  if (result.status !== 400 && result.status !== 404) return false;
  const detail = result.detail ?? "";
  return detail.includes("UNREGISTERED") || detail.includes("INVALID_ARGUMENT");
}

// ---------------------------------------------------------------------------
// Edge function handler
// ---------------------------------------------------------------------------

serve(async (req) => {
  const origin = req.headers.get("origin");
  const cors = originHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  try {
    // Verify JWT
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

    const body = await req.json();
    const { userId, title, body: pushBody } = body;

    if (!userId || !title || !pushBody) {
      return new Response(
        JSON.stringify({ error: "userId, title, and body are required" }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    // Only allow sending to self (or business owner's team)
    // For MVP: only allow sending push to your own user id
    if (userId !== caller.id) {
      return new Response(
        JSON.stringify({ error: "Can only send push to your own account" }),
        { status: 403, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    // Look up device token
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("device_token, fcm_token, device_platform")
      .eq("id", userId)
      .single();

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: "Profile not found" }),
        { status: 404, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    const useFcm = profile.device_platform === "android" || Boolean(profile.fcm_token);
    if (useFcm && !profile.fcm_token) {
      return new Response(
        JSON.stringify({
          sent: false,
          channel: "fcm",
          message: "No device token registered",
        }),
        { status: 200, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    if (useFcm) {
      const account = getFcmServiceAccount();
      const result = await sendFcmPush(account.project_id, profile.fcm_token, title, pushBody);
      if (!result.success) {
        if (isInvalidFcmToken(result)) {
          await supabaseAdmin
            .from("profiles")
            .update({ fcm_token: null, device_platform: null })
            .eq("id", userId);
        }
        return new Response(
          JSON.stringify({
            sent: false,
            channel: "fcm",
            fcmStatus: result.status,
            detail: result.detail,
          }),
          { status: 200, headers: { ...cors, "Content-Type": "application/json" } },
        );
      }
      return new Response(
        JSON.stringify({ sent: true, channel: "fcm", status: result.status }),
        { status: 200, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    if (!profile.device_token) {
      return new Response(
        JSON.stringify({
          sent: false,
          channel: "apns",
          message: "No device token registered",
        }),
        { status: 200, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    // Send iOS push via APNs
    const result = await sendApnsPush(profile.device_token, title, pushBody);

    if (!result.success) {
      // If token is invalid (410 Gone = device unregistered), clear it
      if (result.status === 410) {
        await supabaseAdmin
          .from("profiles")
          .update({ device_token: null })
          .eq("id", userId);
      }
      return new Response(
        JSON.stringify({
          sent: false,
          channel: "apns",
          apnsStatus: result.status,
          detail: result.detail,
        }),
        { status: 200, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ sent: true, channel: "apns", status: result.status }),
      { status: 200, headers: { ...cors, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("send-push error:", err);
    return new Response(
      JSON.stringify({ error: "Internal error" }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }
});
