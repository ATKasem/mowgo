# SEO static-page pipeline (MowGo)

HashRouter SPA → real-path static pages for crawlers.

## Flow
1. `npm run build`
2. `npx vite preview --port 4173` (serve dist) + `python3 /opt/data/scripts/seo_collector.py` (POST collector on 4180)
3. Browser: navigate `http://localhost:4173/?x=N#/<route>`, then in console:
   `fetch('http://127.0.0.1:4180/save?path=<path>', {method:'POST', headers:{'Content-Type':'text/plain'}, body: document.documentElement.outerHTML})`
4. `python3 scripts/seo_postprocess.py` — injects canonical, per-page OG, loader redirect (1.6s → /#/<path>)
5. `npm run build` — public/ (incl. seo/, robots.txt, sitemap.xml, _redirects) copied to dist/

## Serving
`public/_redirects` rewrites `/path → /seo/path/index.html` (200) on Cloudflare Pages.
Humans land on the static snapshot then get redirected into the hash app; crawlers index the static HTML.

## Refresh when copy changes
Re-run steps 2–4 for affected routes only (collector overwrites; postprocess is idempotent).

## Gotchas
- Browser caches old bundles — append `?x=N` to the preview URL to bust.
- RouteAudit uses raw `useTranslation()` (flat keys `routeAudit.seo_title`), other pages use `tr()` — don't mix.
- Every page must call `usePageTitle` or it inherits the previous route's title (SPA bug).
