// CF Pages Function: SMS opt-in capture (A2P 10DLC compliance).
// POST /api/sms-optin  { phone: "4055550123", consent_info: true, consent_mkt: false }
// Validates US number, rate-limits per IP, stores in Supabase sms_optins (service role).
export async function onRequestPost(context) {
  const env = context.env;
  const body = await context.request.json().catch(() => null);
  const phone = (body?.phone || "").replace(/\D/g, "");
  const consentInfo = !!body?.consent_info;
  const consentMkt = !!body?.consent_mkt;
  if (!/^(1?\d{10})$/.test(phone)) {
    return json({ ok: false, error: "Enter a valid 10-digit US phone number." }, 400);
  }
  const e164 = "+" + (phone.length === 10 ? "1" + phone : phone);

  // in-memory rate limit: 10 per 15 min per IP (per-isolate, same pattern as booking.js)
  const ip = context.request.headers.get("CF-Connecting-IP") || "unknown";
  const now = Date.now();
  const win = (globalThis.__smsOptinRl ||= new Map());
  const hits = (win.get(ip) || []).filter((t) => now - t < 15 * 60 * 1000);
  if (hits.length >= 10) return json({ ok: false, error: "Too many attempts — try again later." }, 429);
  hits.push(now); win.set(ip, hits);

  const svc = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!svc) return json({ ok: false, error: "Server misconfigured." }, 500);
  const supabaseUrl = env.SUPABASE_URL || env.PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) return json({ ok: false, error: "Server misconfigured." }, 500);

  const res = await fetch(`${supabaseUrl}/rest/v1/sms_optins`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: svc,
      Authorization: `Bearer ${svc}`,
      Prefer: "return=minimal,resolution=ignore-duplicates",
    },
    body: JSON.stringify({ phone: e164, source: "sms-optin-page", consent_info: consentInfo, consent_mkt: consentMkt }),
  });
  if (!res.ok) return json({ ok: false, error: "Could not save your number — try again." }, 500);
  return json({ ok: true });
}

function json(obj, status = 200) {
  // Public unauthenticated endpoint, but follow the allowlist convention
  // (origin echo/`*` banned elsewhere; opt-in page lives on mowgoapp.com).
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "https://mowgoapp.com",
      "Vary": "Origin",
    },
  });
}
