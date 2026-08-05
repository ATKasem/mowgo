/**
 * Shared webhook URL validation (SSRF defense).
 *
 * Cloudflare Pages Functions run on the Workers runtime, which blocks
 * outbound fetch() to private IPs at the platform level. These checks are
 * defense-in-depth on top of that: they reject private IP literals AND
 * private IPs returned by DNS resolution (DNS rebinding), so a webhook URL
 * pointing at a host that resolves to 169.254.169.254 / 10.x / etc. is
 * rejected before fetch() is ever called.
 */

/** Private / link-local / metadata ranges (IPv4). */
const PRIVATE_IPV4 = [
  /^0\./,                        // 0.0.0.0/8
  /^10\./,                       // 10.0.0.0/8
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./, // 100.64.0.0/10 CGNAT (100.64-127)
  /^127\./,                      // loopback
  /^169\.254\./,                 // link-local (incl. AWS metadata)
  /^172\.(1[6-9]|2\d|3[01])\./,  // 172.16.0.0/12
  /^192\.0\.0\./,                // 192.0.0.0/24 (IETF protocol assignments)
  /^192\.0\.2\./,                // TEST-NET-1
  /^192\.168\./,                 // RFC1918
  /^198\.(18|19)\./,             // benchmarking
  /^198\.51\.100\./,             // TEST-NET-2
  /^203\.0\.113\./,              // TEST-NET-3
  /^22[4-9]\./,                  // 224.0.0.0/8 multicast (224-229)
  /^23\d\./,                     // multicast (230-239)
  /^2[4-9]\d\./,                 // 240.0.0.0/4 reserved
];

function isPrivateIPv4(ip) {
  return PRIVATE_IPV4.some((re) => re.test(ip));
}

/** True when the string is a plausible public DNS hostname (not an IP). */
function isHostname(value) {
  return (
    typeof value === 'string' &&
    /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/i.test(value) &&
    !/^\d+\.\d+\.\d+\.\d+$/.test(value)
  );
}

/**
 * Validate a webhook URL. Returns { ok: true } or { ok: false, reason }.
 * - Must be https:
 * - Hostname must not be a private IP literal
 * - IPv6 literals are rejected (no legitimate public webhooks need them here)
 * - DNS A records are resolved via Cloudflare DoH and any private answer
 *   rejects the URL (DNS-rebinding defense). DoH failures reject too —
 *   fail-closed: an unresolvable/odd host should not receive traffic.
 */
export async function isSafeWebhookUrl(rawUrl) {
  if (typeof rawUrl !== 'string' || rawUrl.length > 2048) {
    return { ok: false, reason: 'invalid url' };
  }
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { ok: false, reason: 'invalid url' };
  }
  if (parsed.protocol !== 'https:') {
    return { ok: false, reason: 'https required' };
  }
  const host = parsed.hostname.toLowerCase();
  if (host.startsWith('[') || host.includes(':')) {
    return { ok: false, reason: 'ipv6 not allowed' };
  }
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
    if (isPrivateIPv4(host)) return { ok: false, reason: 'private ip blocked' };
    return { ok: true };
  }
  if (!isHostname(host)) {
    return { ok: false, reason: 'invalid hostname' };
  }

  // DNS-rebinding defense: resolve A records via Cloudflare DoH (JSON).
  try {
    const dohUrl =
      'https://cloudflare-dns.com/dns-query?name=' +
      encodeURIComponent(host) +
      '&type=A';
    const resp = await fetch(dohUrl, {
      headers: { accept: 'application/dns-json' },
      signal: AbortSignal.timeout(4000),
    });
    if (!resp.ok) return { ok: false, reason: 'dns check failed' };
    const data = await resp.json();
    const answers = Array.isArray(data?.Answer) ? data.Answer : [];
    const addresses = answers
      .filter((a) => a.type === 1 && typeof a.data === 'string')
      .map((a) => a.data);
    if (addresses.length === 0) {
      // No A records (NXDOMAIN / only-AAAA). Reject — nothing safe to call.
      return { ok: false, reason: 'no a records' };
    }
    for (const ip of addresses) {
      if (isPrivateIPv4(ip)) return { ok: false, reason: 'private ip blocked' };
    }
    return { ok: true };
  } catch {
    return { ok: false, reason: 'dns check failed' };
  }
}
