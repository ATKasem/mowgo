-- Rates lead magnet (functions/api/rates.js) reuses lead_touches for its
-- instant/day3/day7 nurture rows, but the original CHECK constraints
-- (20260806150500_lead_touches.sql) only allow source IN ('route_audit',
-- 'signup') and kind IN ('instant', 'day2', 'day7'). Widen both so
-- source='rates_report' / kind='day3' inserts don't fail their CHECK.
--
-- NOTE: scripts/lead_nurture.py only queries kind IN ('day2', 'day7') and
-- has no EMAIL_CONTENT/SMS_CONTENT entries for 'day3' — day3 rows inserted
-- by rates.js will sit 'queued' indefinitely until that script (or an
-- equivalent) is extended to process kind='day3' with rates-report-specific
-- copy. This migration only unblocks the insert; it does not wire up
-- delivery of the day3/day7 follow-ups.
ALTER TABLE lead_touches DROP CONSTRAINT lead_touches_source_check;
ALTER TABLE lead_touches ADD CONSTRAINT lead_touches_source_check
  CHECK (source IN ('route_audit', 'signup', 'rates_report'));

ALTER TABLE lead_touches DROP CONSTRAINT lead_touches_kind_check;
ALTER TABLE lead_touches ADD CONSTRAINT lead_touches_kind_check
  CHECK (kind IN ('instant', 'day2', 'day3', 'day7'));
