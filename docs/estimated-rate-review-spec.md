# Estimated Rate Client Review

## Goal
Help lawn-care owners find clients whose scheduled visit price produces a materially below-average estimated hourly rate, without presenting estimates as actual time tracking.

## Scope
Web only. Primary surface is Clients. Dashboard gets one compact Needs Attention item linking to Clients. No Invoices redesign and no actual time tracking in this batch.

## Calculation
For each client with at least 2 completed jobs and a positive `duration_minutes`:
- estimated hourly rate = client.rate / (duration_minutes / 60)
- client average = mean estimated hourly rate across eligible clients
- flag when client rate is below both 75% of the client average and $50/hour; avoid small-sample noise.
- use completed jobs only; use scheduled duration; label every result `Estimated rate based on scheduled duration`.
- exclude zero/negative rates, missing/invalid durations, and clients with fewer than 2 completed jobs.

## Clients UI
Add a `Needs Review` segment alongside Clients and Leads. Show flagged clients with rate, scheduled minutes, estimated hourly rate, and comparison to average. Expandable review details include explicit explanation and actions to edit client price or duration through existing workflows. No claim that a client is bad; say review price, service time, and route value.

## Dashboard UI
Owner-only attention item: `N clients below your estimated hourly-rate target` linking to `/app/clients?segment=review`. Do not load or show this for crew users.

## Safeguards
- No recommendation based on one completed job.
- No false actual-time language.
- No client flag when all data is incomplete.
- Preserve existing Clients/Leads behavior and privacy.
- English/Spanish locale parity.

## Verification
Focused pure helper tests for eligible filtering, average/threshold, malformed input, and no-flag states. Build, lint, i18n integrity, and trifecta review before commit/push.
