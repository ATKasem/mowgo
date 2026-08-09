# MowGo Trifecta Implementation Plan

## Goal
Apply the Dan Martell + Alex Hormozi + Alex Becker trifecta to MowGo without weakening product trust: sharpen the operating promise, improve the conversion path, increase activation and retention, and reduce founder-dependent delivery.

## Non-negotiables
- Product-first: do not market broken or unbuilt features as shipped.
- Preserve verified claims only; no invented testimonials, stats, or outcomes.
- English and Spanish locale parity for all new web copy.
- Web-only changes in this pass; do not touch iOS or Android.
- Preserve existing uncommitted work; modify only explicitly scoped files.
- Keep the current prices: Free (5 clients), Solo $39, Crew $79, Premium $199.
- Concierge promises must match actual queue/SLA capability.
- Use existing patterns; no broad refactor.

## Lens decisions
- Dan: first-run activation, concierge queue/SLA, repeatable onboarding, founder handoff boundaries, activation measurement.
- Hormozi ($100M Offers, Leads, Money Models): pain-first promise, value stack, proof-before-price, Core Four acquisition, annual/continuity/downsell/win-back sequence.
- Becker: breakage-based positioning, lawn-crew niche, simple funnel, comparison pages as support, proof/tracking before paid scale.

## Planned implementation slices
1. Strategy and copy source of truth: add/refresh a trifecta strategy document and align landing/compare/subscribe copy around one operating outcome.
2. Funnel: make primary CTA and message outcome-led; keep competitor pages supporting rather than leading.
3. Activation: first-run checklist/CTA and activation event tracking, using existing app patterns; do not build a parallel analytics system if current data model can be extended safely.
4. Concierge leverage: make the promise, queue capacity, SLA, and premium priority behavior consistent; document the human operating checklist.
5. Retention/money model: add or spec the safe Crew→Solo downsell, seasonal pause, win-back, and post-win referral asks where existing payment architecture supports it; do not invent unsupported Stripe behavior.
6. Verify: build, i18n integrity, targeted tests, diff audit, and adversarial Claude + Codex review before any commit/push.

## Owner actions after implementation
- Personally run the concierge queue for the first proof cohort.
- Recruit and onboard 5–10 real lawn operators.
- Capture one verified case study after a real activation win.
- Review weekly activation: first client, first job, first invoice.
- Do not add new features until activation and proof gaps are measured.
- Approve any public copy claims before publishing ads or social posts.

## Adversarial gates before production code
- **G1 No copy without backend:** every new Landing/Compare/Subscribe promise must map to an existing or same-changeset backend capability.
- **G2 Concierge truth:** choose one promise and use it everywhere. Standardize on "first operating week" unless the backend is changed to truly schedule/review 30 days. Remove "founder-reviewed" unless a human review step exists. Keep "priority" only if Premium queue priority and its SLA are implemented; otherwise remove it.
- **G3 Scarcity enforcement:** do not publish "20/week" unless the queue enforces or transparently displays capacity.
- **G4 i18n-first:** all new copy must use existing localization patterns. Do not add more raw English to plan arrays. Existing plan-array i18n debt is separate and cannot be silently expanded.
- **G5 ES parity:** every new EN key gets an ES counterpart; preserve existing orphan ES keys. Run the flat-key parity check.
- **G6 Annual billing guard:** do not add annual-selling copy unless Solo/Crew annual Stripe IDs are confirmed. Otherwise hide the option or label it Coming soon.
- **G7 Retention truth:** do not advertise downsell, pause, or win-back behavior until the actual Stripe/email flow exists.
- **G8 Dirty-file isolation:** never use `git add -A` or `git add .`. Stage only named files and verify staged names against this plan.

## Agent coordination contract
All coding agents must load/use the trifecta framing: attribute decisions to Dan/Hormozi/Becker, keep copy/plan/pricing/feature claims consistent across surfaces, and report unsupported promises instead of papering over them. The three critical decisions are: standardize on first operating week; remove founder-reviewed unless a human review step exists; remove Premium priority until queue priority/SLA is real.

Codex is the primary builder. Claude Code is the adversarial reviewer and consistency auditor. Hermes verifies all claims independently. Codex must not commit or push without Claude review and Hermes staged-diff verification.

## Review handoff
1. Codex implements one independently testable slice at a time.
2. Claude reviews the exact diff for consistency, security, i18n, and copy-to-backend truth.
3. Codex fixes every finding, including LOW/edge findings.
4. Hermes runs build, i18n parity, targeted behavior checks, and staged-file audit.
5. Only then may a commit/push be considered.

## Open owner decisions after code work
- Confirm whether Blasian personally reviews the first operating week or the product auto-schedules it.
- Provide/confirm Solo and Crew annual Stripe price IDs before enabling annual copy.
- Decide the real Premium queue capacity and SLA before restoring "priority."
- Decide whether Spanish plans-array localization is a separate approved scope expansion.
- Run the first 5–10 customer cohort and capture one verified case study before paid acquisition.

## Iterative trifecta approval loop
For every production slice, repeat this loop until the trifecta review is clean:
1. Codex implements the smallest complete capability, including backend, tests, and truthful copy only when the capability is real.
2. Claude Code reviews the exact diff as an adversarial consistency, security, product, and copy-to-backend audit.
3. If Claude finds any issue, Codex fixes every finding, including LOW/edge cases, and the exact diff is reviewed again.
4. Hermes independently verifies builds, tests, i18n parity, live behavior where applicable, staged-file isolation, and the Dan/Hormozi/Becker decision criteria.
5. Do not commit, push, or call the slice approved until all three agree: product capability works, copy is earned, and the strategy is coherent.

The strategy document exists. Concierge capability work is next. Production code remains unapproved until the loop above passes.

## Status
Plan created before implementation. Agents must preserve unrelated dirty files and avoid commits/pushes unless explicitly instructed after review.
