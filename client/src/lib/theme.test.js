import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultThemeForRoute, themeForRoute } from './theme.js';

function isMarketingRoute(pathname) {
  return ['/', '/compare', '/subscribe', '/switch-from-lawnpro', '/quoteiq-alternative', '/blog/'].some(route => {
    if (route === '/') return pathname === route;
    if (route.endsWith('/')) return pathname.startsWith(route);
    return pathname === route || pathname.startsWith(`${route}/`);
  });
}

test('public marketing routes default to dark', () => {
  for (const route of ['/', '/compare', '/compare/ruunly', '/subscribe', '/switch-from-lawnpro', '/quoteiq-alternative', '/blog/jobber-price-increase-2026']) {
    assert.equal(isMarketingRoute(route), true, route);
    assert.equal(defaultThemeForRoute(route), 'dark', route);
  }
});

test('authenticated app routes use the same dark-first default', () => {
  assert.equal(isMarketingRoute('/app'), false);
  assert.equal(isMarketingRoute('/app/today'), false);
  assert.equal(isMarketingRoute('/compare-prices'), false);
  assert.equal(defaultThemeForRoute('/app'), 'dark');
});

test('an explicit stored preference wins without creating a default preference', () => {
  const values = new Map();
  globalThis.localStorage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };

  assert.equal(themeForRoute('/'), 'dark');
  assert.equal(themeForRoute('/app'), 'dark');
  assert.equal(values.size, 0);

  values.set('mowgo-theme', 'light');
  assert.equal(themeForRoute('/'), 'light');
  assert.equal(themeForRoute('/app'), 'light');
});
