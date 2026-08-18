# Per-Crew-Member Billing — Implementation Spec

## Goal
Add per-crew-member pricing to the Crew tier ($79/mo) so that growing teams pay more as they grow. First crew member is included in the base price; each additional is $10/mo.

## What Changed

### New file: `functions/api/_shared/update-crew-quantity.js`
Shared helper that counts an owner's crew members and syncs their Stripe subscription add-on quantity. Called after invite acceptance and crew member removal. Best-effort — never fails the caller.

### Modified: `functions/api/invite-crew.js`
- Added import of `updateCrewQuantity`
- Calls `await updateCrewQuantity(env, ownerId)` on all 3 success paths (new user, existing user new profile, existing user existing profile)

### Modified: `functions/api/team/[memberId].js`
- Added import of `updateCrewQuantity`
- Calls `await updateCrewQuantity(env, ownerId)` after successfully detaching a crew member

### Modified: `client/src/pages/Subscribe.jsx`
Crew plan card now shows:
- "You + 1 crew member included"
- "Additional crew $10/mo per member"

### Modified: `client/src/pages/Compare.jsx`
Same pricing display update for the MowGo Crew tier row.

## What Needs to Be Done (separately, dashboard)

1. **Create Stripe prices:**
   - `STRIPE_PRICE_CREW_ADDON` — $10/mo ($10.00 unit_amount, recurring monthly)
   - `STRIPE_PRICE_CREW_ADDON_ANNUAL` — $100/yr ($100.00 unit_amount, recurring yearly)

2. **Set CF dashboard env vars:**
   - `STRIPE_PRICE_CREW_ADDON` = price_xxx (monthly)
   - `STRIPE_PRICE_CREW_ADDON_ANNUAL` = price_yyy (annual)

## Edge Cases Covered

- **Solo/Free/Premium users:** `updateCrewQuantity` checks `profile.tier !== 'crew'` and returns early. No impact.
- **Crew tier with 0 crew members:** add-on qty = max(0, 0 - 1) = 0. Subscriptions only have the base $79 price.
- **Crew tier with 1 crew member (free slot):** add-on qty = max(0, 1 - 1) = 0. No extra charge.
- **Crew tier with 2+ crew members:** add-on qty = crewCount - 1. Billed at $10/mo each.
- **Existing Crew subscribers:** Grandfathered on old pricing until they add a 2nd crew member (which triggers updateCrewQuantity).
- **Invite accepted but owner no longer on Crew:** updateCrewQuantity returns early. No billing change.
- **Annual billing:** helper detects the base subscription item's billing interval and uses `STRIPE_PRICE_CREW_ADDON_ANNUAL` for annual subscriptions, `STRIPE_PRICE_CREW_ADDON` for monthly. (Stripe rejects subscriptions that mix monthly and yearly recurring prices, so reusing the monthly price on an annual subscription is not viable — the write would be rejected outright, not merely "prorate slightly.") If the interval's price isn't configured yet, it's a no-op.
- **Best-effort only:** All updateCrewQuantity calls are fire-and-forget. Crew member add/remove always succeeds even if Stripe billing sync fails.