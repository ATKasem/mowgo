-- 009_booking_slot_unique.sql
-- Prevent double-booking the same slot: unique index on
-- (user_id, scheduled_date, scheduled_time) for scheduled jobs.
-- Partial index — only scheduled/in_progress jobs block a slot.
CREATE UNIQUE INDEX IF NOT EXISTS idx_jobs_booking_slot
  ON jobs (user_id, scheduled_date, scheduled_time)
  WHERE status IN ('scheduled', 'in_progress');
