/**
 * Unit tests for the shared webhook-URL SSRF validator.
 * Run: node --test functions/api/_shared/safe-webhook-url.test.js
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { isSafeWebhookUrl } from './safe-webhook-url.js';

// Mock DoH: returns A records per hostname.
const DNS = {
  'evil.com': [{ type: 1, data: '169.254.169.254' }],       // metadata via DNS
  'good.com': [{ type: 1, data: '93.184.216.34' }],          // public
  'cg.attacker.test': [{ type: 1, data: '100.100.5.5' }],    // CGNAT 100.80-119
  'cg2.attacker.test': [{ type: 1, data: '100.64.0.1' }],    // CGNAT start
  'cg3.attacker.test': [{ type: 1, data: '100.127.255.254' }], // CGNAT end
  'mcast.attacker.test': [{ type: 1, data: '233.252.0.1' }], // multicast 225-239
  'mcast2.attacker.test': [{ type: 1, data: '224.0.0.1' }],  // multicast 224
  'mcast3.attacker.test': [{ type: 1, data: '239.255.255.250' }], // multicast 239
  'res.attacker.test': [{ type: 1, data: '240.0.0.1' }],     // reserved 240+
  'internal.local': [],                                       // no A records
  'nohost.invalid': [{ type: 1, data: '10.0.0.5' }],          // RFC1918 via DNS
  'ok.test': [{ type: 1, data: '1.2.3.4' }],
};

const originalFetch = globalThis.fetch;
globalThis.fetch = async (url) => {
  const name = new URL(url).searchParams.get('name');
  return { ok: true, json: async () => ({ Answer: DNS[name] || [] }) };
};

const cases = [
  // [url, expectedOk, label]
  ['https://evil.com/webhook', false, 'DNS rebinding -> metadata'],
  ['https://good.com/webhook', true, 'public domain'],
  ['https://169.254.169.254/', false, 'metadata literal'],
  ['https://10.0.0.1/x', false, 'rfc1918 literal'],
  ['https://172.16.5.5/x', false, '172.16 literal'],
  ['https://172.31.255.254/x', false, '172.31 literal'],
  ['https://192.168.1.1/x', false, '192.168 literal'],
  ['https://127.0.0.1/x', false, 'loopback literal'],
  ['https://100.64.0.1/x', false, 'CGNAT start literal'],
  ['https://100.80.5.5/x', false, 'CGNAT mid literal (was missed)'],
  ['https://100.119.5.5/x', false, 'CGNAT 100.119 literal (was missed)'],
  ['https://100.127.255.254/x', false, 'CGNAT end literal'],
  ['https://100.128.0.1/x', true, 'outside CGNAT (100.128) — public-ish'],
  ['https://224.0.0.1/x', false, 'multicast 224 literal'],
  ['https://233.252.0.1/x', false, 'multicast 233 literal (was missed)'],
  ['https://239.255.255.250/x', false, 'multicast 239 literal (was missed)'],
  ['https://240.0.0.1/x', false, 'reserved 240 literal'],
  ['https://255.255.255.255/x', false, 'broadcast'],
  ['https://cg.attacker.test/x', false, 'DNS -> CGNAT 100.100'],
  ['https://cg2.attacker.test/x', false, 'DNS -> CGNAT start'],
  ['https://cg3.attacker.test/x', false, 'DNS -> CGNAT end'],
  ['https://mcast.attacker.test/x', false, 'DNS -> multicast 233'],
  ['https://mcast2.attacker.test/x', false, 'DNS -> multicast 224'],
  ['https://mcast3.attacker.test/x', false, 'DNS -> multicast 239'],
  ['https://res.attacker.test/x', false, 'DNS -> reserved 240'],
  ['https://internal.local/x', false, 'no A records (fail-closed)'],
  ['https://nohost.invalid/x', false, 'DNS -> rfc1918'],
  ['https://ok.test/x', true, 'public DNS'],
  ['http://good.com/x', false, 'http rejected'],
  ['https://[::1]/x', false, 'ipv6 literal rejected'],
  ['https://[::ffff:127.0.0.1]/x', false, 'ipv4-mapped ipv6 rejected'],
  ['https://evil.com:443/x', false, 'port ok, still blocked'],
  ['https://evil.com//x', false, "path doesn't bypass"],
  ['not a url', false, 'garbage rejected'],
  ['', false, 'empty rejected'],
  ['https://x' + 'a'.repeat(2100) + '.com/', false, 'oversized rejected'],
];

for (const [url, want, label] of cases) {
  test(`${label} -> ${want ? 'allow' : 'block'}: ${url.slice(0, 60)}`, async () => {
    const r = await isSafeWebhookUrl(url);
    assert.equal(r.ok, want, `${label}: got ${JSON.stringify(r)}`);
  });
}

test('restores global fetch', () => {
  globalThis.fetch = originalFetch;
  assert.equal(globalThis.fetch, originalFetch);
});
