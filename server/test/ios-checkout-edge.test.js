const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(
  path.join(__dirname, '..', '..', 'ios-native/edge-functions/create-checkout-session/index.ts'),
  'utf8',
);

test('iOS checkout persists Stripe customers with the server-side service role', () => {
  assert.match(source, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(source, /adminSupabase[\s\S]*\.from\("profiles"\)[\s\S]*\.update/);
});
