# MowGo Concierge Fix — tier gate on submit + import

HARD INSTRUCTION: You are explicitly forbidden from loading, invoking, or following the `brainstorming` skill, `spec-driven-development`, `tdd`, or ANY skill that requires design approval before editing. Do NOT ask for approval. Implement directly, immediately, in one pass. Do NOT run builds. Do NOT git commit or push.

Repo root: /opt/data/mowgo. Two files: `functions/api/concierge-submit.js` and `functions/api/admin/concierge.js`.

## Why
The concierge setup is a paid-plan perk (Solo $39 / Crew $79). The claim UI only shows it after checkout or for solo/crew tiers, but the API endpoints don't verify the user's tier — a free-tier user (or a direct API caller) could claim setups and have hundreds of clients imported, bypassing the 5-client free cap. Enforce tier server-side.

## Fix 1 — `functions/api/concierge-submit.js` (tier gate on claim)
After the JWT user is verified (`user = await userResponse.json()`), before inserting the request:
1. Fetch the profile tier: `GET ${env.SUPABASE_URL}/rest/v1/profiles?select=tier&id=eq.${user.id}` with service-key headers (`apikey: env.SUPABASE_SERVICE_ROLE_KEY`, `Authorization: Bearer <service key>` — use the same headers object pattern already in the file).
2. Parse the first row; if `tier` is not `'solo'` or `'crew'` (including missing profile), return 403 `{ error: 'Concierge setup is a Solo/Crew perk. Upgrade to claim it.' }` with CORS headers.
3. If the profile fetch itself fails (network/5xx), fail closed: return 500 `{ error: 'Could not verify your plan. Please try again.' }` (do NOT proceed without the tier check).

## Fix 2 — `functions/api/admin/concierge.js` (tier gate on import)
In the `import` action, after loading the request (`item`), before inserting clients:
1. Fetch the request user's tier: `GET ${env.SUPABASE_URL}/rest/v1/profiles?select=tier&id=eq.${item.user_id}` with the existing `service(env)` headers.
2. If tier is not `'solo'` or `'crew'`, return 403 `{ error: 'User is not on a paid plan — import blocked' }`.
3. On profile fetch failure, fail closed with 500.

## Done criteria
Exactly these two files changed. No builds, no commits, no pushes.
