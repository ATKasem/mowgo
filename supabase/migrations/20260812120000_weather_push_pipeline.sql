-- Weather-to-push pipeline: persisted opt-in, dedup reservations, and daily cron.
-- Before the cron can run, create Vault secrets named project_url,
-- service_role_key, and weather_push_cron_secret. The cron secret must match
-- WEATHER_PUSH_CRON_SECRET on the weather-push Edge Function.

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS supabase_vault WITH SCHEMA vault;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS rain_alerts_enabled BOOLEAN NOT NULL DEFAULT true;
GRANT UPDATE (rain_alerts_enabled) ON profiles TO authenticated;

CREATE TABLE IF NOT EXISTS weather_push_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  forecast_date DATE NOT NULL,
  notification_kind TEXT NOT NULL DEFAULT 'alert',
  reasons TEXT[] NOT NULL DEFAULT '{}',
  nws_alert_ids TEXT[] NOT NULL DEFAULT '{}',
  reservation_token UUID NOT NULL DEFAULT gen_random_uuid(),
  reserved_until TIMESTAMPTZ NOT NULL DEFAULT now() + interval '5 minutes',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ,
  CONSTRAINT weather_push_events_event_key_length CHECK (char_length(event_key) BETWEEN 1 AND 128),
  CONSTRAINT weather_push_events_notification_kind_length CHECK (char_length(notification_kind) BETWEEN 1 AND 32)
);

-- Keep the migration re-runnable after a partial/out-of-band application.
ALTER TABLE weather_push_events
  ADD COLUMN IF NOT EXISTS notification_kind TEXT NOT NULL DEFAULT 'alert',
  ADD COLUMN IF NOT EXISTS nws_alert_ids TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS reservation_token UUID NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS reserved_until TIMESTAMPTZ NOT NULL DEFAULT now() + interval '5 minutes';

CREATE UNIQUE INDEX IF NOT EXISTS weather_push_events_event_key_uidx
  ON weather_push_events (event_key);
CREATE INDEX IF NOT EXISTS weather_push_events_user_date_idx
  ON weather_push_events (user_id, forecast_date DESC);
CREATE INDEX IF NOT EXISTS weather_push_events_cleanup_idx
  ON weather_push_events (COALESCE(sent_at, reserved_until));

ALTER TABLE weather_push_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE weather_push_events FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE weather_push_events TO service_role;

CREATE OR REPLACE FUNCTION public.reserve_weather_push_event(
  p_event_key TEXT,
  p_user_id UUID,
  p_forecast_date DATE,
  p_notification_kind TEXT,
  p_reasons TEXT[],
  p_nws_alert_ids TEXT[]
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token UUID := gen_random_uuid();
  v_reserved_token UUID;
BEGIN
  INSERT INTO public.weather_push_events (
    event_key, user_id, forecast_date, notification_kind, reasons,
    nws_alert_ids, reservation_token, reserved_until
  ) VALUES (
    p_event_key, p_user_id, p_forecast_date, p_notification_kind,
    COALESCE(p_reasons, '{}'), COALESCE(p_nws_alert_ids, '{}'),
    v_token, now() + interval '5 minutes'
  )
  ON CONFLICT (event_key) DO UPDATE
    SET reasons = EXCLUDED.reasons,
        nws_alert_ids = EXCLUDED.nws_alert_ids,
        reservation_token = EXCLUDED.reservation_token,
        reserved_until = EXCLUDED.reserved_until
    WHERE weather_push_events.sent_at IS NULL
      AND weather_push_events.reserved_until <= now()
  RETURNING reservation_token INTO v_reserved_token;

  RETURN v_reserved_token;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_weather_push_event(
  p_event_key TEXT,
  p_reservation_token UUID
) RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH deleted AS (
    DELETE FROM public.weather_push_events
    WHERE event_key = p_event_key
      AND reservation_token = p_reservation_token
      AND sent_at IS NULL
    RETURNING 1
  )
  SELECT EXISTS (SELECT 1 FROM deleted);
$$;

CREATE OR REPLACE FUNCTION public.mark_weather_push_event_sent(
  p_event_key TEXT,
  p_reservation_token UUID
) RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH updated AS (
    UPDATE public.weather_push_events
    SET sent_at = now()
    WHERE event_key = p_event_key
      AND reservation_token = p_reservation_token
      AND sent_at IS NULL
    RETURNING 1
  )
  SELECT EXISTS (SELECT 1 FROM updated);
$$;

REVOKE ALL ON FUNCTION public.reserve_weather_push_event(TEXT, UUID, DATE, TEXT, TEXT[], TEXT[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_weather_push_event(TEXT, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mark_weather_push_event_sent(TEXT, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_weather_push_event(TEXT, UUID, DATE, TEXT, TEXT[], TEXT[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_weather_push_event(TEXT, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_weather_push_event_sent(TEXT, UUID) TO service_role;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'mowgo-weather-push-daily') THEN
    PERFORM cron.schedule(
      'mowgo-weather-push-daily',
      '0 11 * * *',
      $cron$
        SELECT net.http_post(
          url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url' LIMIT 1)
            || '/functions/v1/weather-push',
          headers := jsonb_build_object(
            'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1),
            'Content-Type', 'application/json',
            'x-mowgo-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'weather_push_cron_secret' LIMIT 1)
          ),
          body := '{}'::jsonb,
          timeout_milliseconds := 30000
        );
      $cron$
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'mowgo-weather-push-events-cleanup') THEN
    PERFORM cron.schedule(
      'mowgo-weather-push-events-cleanup',
      '30 3 * * 0',
      $cron$
        DELETE FROM public.weather_push_events
        WHERE sent_at < now() - interval '90 days'
           OR (sent_at IS NULL AND reserved_until < now() - interval '1 day');
      $cron$
    );
  END IF;
END $$;
