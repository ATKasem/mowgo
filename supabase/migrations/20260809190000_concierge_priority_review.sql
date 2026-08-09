-- Concierge queue priority, auditable SLA/status lifecycle, human review, and
-- retry-safe import/scheduling. No weekly capacity is claimed or enforced.

ALTER TABLE concierge_requests
  ADD COLUMN IF NOT EXISTS tier_at_request text,
  ADD COLUMN IF NOT EXISTS priority_rank integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS business_timezone text NOT NULL DEFAULT 'America/Chicago',
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS sla_due_at timestamptz,
  ADD COLUMN IF NOT EXISTS import_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS imported_at timestamptz,
  ADD COLUMN IF NOT EXISTS schedule_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS scheduled_at timestamptz,
  ADD COLUMN IF NOT EXISTS review_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS skipped_at timestamptz,
  ADD COLUMN IF NOT EXISTS skipped_by_operator_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS skip_notes text,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS last_operator_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS operator_checklist jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS import_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS schedule_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS scheduled_job_ids uuid[] NOT NULL DEFAULT '{}';

UPDATE concierge_requests cr
SET submitted_at = COALESCE(cr.submitted_at, cr.created_at),
    sla_due_at = COALESCE(cr.sla_due_at, cr.created_at + interval '48 hours'),
    tier_at_request = COALESCE(cr.tier_at_request, CASE WHEN p.tier IN ('solo', 'crew', 'premium') THEN p.tier END),
    priority_rank = CASE WHEN COALESCE(cr.tier_at_request, p.tier) = 'premium' THEN 100 ELSE 0 END
FROM profiles p
WHERE p.id = cr.user_id;

ALTER TABLE concierge_requests
  ALTER COLUMN submitted_at SET DEFAULT now(),
  ALTER COLUMN submitted_at SET NOT NULL,
  ALTER COLUMN sla_due_at SET NOT NULL;

ALTER TABLE concierge_requests DROP CONSTRAINT IF EXISTS concierge_requests_status_check;
ALTER TABLE concierge_requests ADD CONSTRAINT concierge_requests_status_check
  CHECK (status IN ('pending', 'importing', 'review', 'done', 'skipped'));
ALTER TABLE concierge_requests DROP CONSTRAINT IF EXISTS concierge_requests_tier_at_request_check;
ALTER TABLE concierge_requests ADD CONSTRAINT concierge_requests_tier_at_request_check
  CHECK (tier_at_request IS NULL OR tier_at_request IN ('solo', 'crew', 'premium'));
ALTER TABLE concierge_requests DROP CONSTRAINT IF EXISTS concierge_requests_priority_rank_check;
ALTER TABLE concierge_requests ADD CONSTRAINT concierge_requests_priority_rank_check
  CHECK (priority_rank IN (0, 100));
ALTER TABLE concierge_requests DROP CONSTRAINT IF EXISTS concierge_requests_business_timezone_check;
ALTER TABLE concierge_requests ADD CONSTRAINT concierge_requests_business_timezone_check
  CHECK (business_timezone = 'America/Chicago');
ALTER TABLE concierge_requests DROP CONSTRAINT IF EXISTS concierge_requests_skip_audit_check;
ALTER TABLE concierge_requests ADD CONSTRAINT concierge_requests_skip_audit_check
  CHECK (
    (status = 'skipped' AND (
      (skipped_at IS NULL AND skipped_by_operator_id IS NULL AND skip_notes IS NULL)
      OR (skipped_at IS NOT NULL AND skipped_by_operator_id IS NOT NULL AND char_length(skip_notes) BETWEEN 1 AND 4000 AND skip_notes = btrim(skip_notes))
    ))
    OR (status <> 'skipped' AND skipped_at IS NULL AND skipped_by_operator_id IS NULL AND skip_notes IS NULL)
  );
ALTER TABLE concierge_requests VALIDATE CONSTRAINT concierge_requests_skip_audit_check;

DROP INDEX IF EXISTS concierge_requests_one_active_per_user;
CREATE UNIQUE INDEX concierge_requests_one_active_per_user
  ON concierge_requests (user_id) WHERE status IN ('pending', 'importing', 'review');
CREATE INDEX IF NOT EXISTS concierge_requests_admin_queue
  ON concierge_requests (priority_rank DESC, created_at ASC)
  WHERE status IN ('pending', 'importing', 'review');

CREATE TABLE IF NOT EXISTS concierge_submit_attempts (
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  ip_hash text NOT NULL CHECK (length(ip_hash) = 64),
  attempted_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE concierge_submit_attempts ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS concierge_submit_attempts_window ON concierge_submit_attempts (user_id, ip_hash, attempted_at DESC);

CREATE OR REPLACE FUNCTION check_concierge_submit_rate_limit(p_user_id uuid, p_ip_hash text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_count integer;
BEGIN
  IF current_setting('request.jwt.claim.role', true) IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'service role required' USING ERRCODE = '42501'; END IF;
  IF p_ip_hash !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'invalid ip hash' USING ERRCODE = '22023'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':' || p_ip_hash, 0));
  DELETE FROM concierge_submit_attempts WHERE user_id=p_user_id AND ip_hash=p_ip_hash AND attempted_at < now()-interval '15 minutes';
  SELECT count(*) INTO v_count FROM concierge_submit_attempts WHERE user_id=p_user_id AND ip_hash=p_ip_hash AND attempted_at >= now()-interval '15 minutes';
  IF v_count >= 20 THEN RETURN false; END IF;
  INSERT INTO concierge_submit_attempts(user_id,ip_hash) VALUES(p_user_id,p_ip_hash);
  RETURN true;
END;
$$;

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS concierge_request_id uuid REFERENCES concierge_requests(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS concierge_source_index integer;
CREATE UNIQUE INDEX IF NOT EXISTS clients_concierge_source_unique
  ON clients (concierge_request_id, concierge_source_index);

CREATE TABLE IF NOT EXISTS concierge_request_clients (
  request_id uuid NOT NULL REFERENCES concierge_requests(id) ON DELETE CASCADE,
  source_index integer NOT NULL,
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  created_by_concierge boolean NOT NULL,
  PRIMARY KEY (request_id, source_index),
  UNIQUE (request_id, client_id)
);
ALTER TABLE concierge_request_clients ENABLE ROW LEVEL SECURITY;

ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS concierge_request_id uuid REFERENCES concierge_requests(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS jobs_concierge_client_unique
  ON jobs (concierge_request_id, client_id);

-- Remove the pre-operator-attribution signatures if this additive migration
-- was applied during an earlier review pass.
DROP FUNCTION IF EXISTS concierge_import_clients(uuid, jsonb);
DROP FUNCTION IF EXISTS concierge_schedule_first_week(uuid);
DROP FUNCTION IF EXISTS concierge_undo_first_week(uuid);

CREATE OR REPLACE FUNCTION concierge_import_clients(p_request_id uuid, p_clients jsonb, p_operator_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_request concierge_requests%ROWTYPE;
  v_clients jsonb;
  v_source record;
  v_client_id uuid;
  v_was_created boolean;
  v_created_count integer := 0;
  v_matched_count integer := 0;
  v_duplicate_count integer := 0;
  v_existing_source_index integer;
  v_results jsonb := '[]'::jsonb;
BEGIN
  IF current_setting('request.jwt.claim.role', true) IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'service role required' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_request FROM concierge_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'request not found' USING ERRCODE = 'P0002'; END IF;
  IF v_request.status NOT IN ('pending', 'importing') THEN RAISE EXCEPTION 'invalid request state' USING ERRCODE = '22023'; END IF;
  IF jsonb_typeof(p_clients) <> 'array' OR jsonb_array_length(p_clients) = 0 OR jsonb_array_length(p_clients) > 70 THEN
    RAISE EXCEPTION 'client list must contain 1 to 70 rows' USING ERRCODE = '22023';
  END IF;
  IF cardinality(v_request.imported_client_ids) > 0 THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'address', c.address, 'created_by_concierge', m.created_by_concierge) ORDER BY m.source_index), '[]'::jsonb)
    INTO v_clients FROM concierge_request_clients m JOIN clients c ON c.id=m.client_id WHERE m.request_id=p_request_id;
    RETURN v_request.import_summary || jsonb_build_object('clients',v_clients,'already_complete',true);
  END IF;

  UPDATE concierge_requests SET status = 'importing', claimed_at = COALESCE(claimed_at, now()), import_started_at = COALESCE(import_started_at, now()), last_operator_id = p_operator_id, updated_at = now() WHERE id = p_request_id;
  FOR v_source IN SELECT * FROM jsonb_to_recordset(p_clients) AS x(source_index integer, name text, address text, phone text, email text, rate numeric) ORDER BY source_index LOOP
    SELECT client_id, created_by_concierge INTO v_client_id, v_was_created FROM concierge_request_clients WHERE request_id=p_request_id AND source_index=v_source.source_index;
    IF v_client_id IS NOT NULL THEN
      v_results := v_results || jsonb_build_array(jsonb_build_object('source_index',v_source.source_index,'client_id',v_client_id,'outcome','already_imported'));
    ELSE
      SELECT c.id INTO v_client_id FROM clients c
      WHERE c.user_id=v_request.user_id AND (
        (NULLIF(regexp_replace(COALESCE(v_source.phone,''),'\D','','g'),'') IS NOT NULL AND regexp_replace(COALESCE(c.phone,''),'\D','','g')=regexp_replace(v_source.phone,'\D','','g'))
        OR (lower(trim(c.name))=lower(trim(v_source.name)) AND lower(trim(COALESCE(c.address,'')))=lower(trim(COALESCE(v_source.address,''))))
      ) ORDER BY c.created_at LIMIT 1;
      v_was_created := false;
      IF v_client_id IS NULL THEN
        INSERT INTO clients(user_id,name,address,phone,email,rate,concierge_request_id,concierge_source_index)
        VALUES(v_request.user_id,v_source.name,v_source.address,NULLIF(v_source.phone,''),NULLIF(v_source.email,''),COALESCE(v_source.rate,0),p_request_id,v_source.source_index)
        RETURNING id INTO v_client_id;
        v_was_created := true;
        v_created_count := v_created_count + 1;
      ELSE
        v_matched_count := v_matched_count + 1;
      END IF;
      SELECT source_index INTO v_existing_source_index FROM concierge_request_clients WHERE request_id=p_request_id AND client_id=v_client_id;
      IF v_existing_source_index IS NOT NULL THEN
        v_duplicate_count := v_duplicate_count + 1;
        v_results := v_results || jsonb_build_array(jsonb_build_object('source_index',v_source.source_index,'client_id',v_client_id,'outcome','duplicate_existing_client','duplicate_of_source_index',v_existing_source_index));
      ELSE
        INSERT INTO concierge_request_clients(request_id,source_index,client_id,created_by_concierge)
        VALUES(p_request_id,v_source.source_index,v_client_id,v_was_created);
        v_results := v_results || jsonb_build_array(jsonb_build_object('source_index',v_source.source_index,'client_id',v_client_id,'outcome',CASE WHEN v_was_created THEN 'created' ELSE 'matched_existing' END));
      END IF;
    END IF;
  END LOOP;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'address', c.address, 'created_by_concierge', m.created_by_concierge) ORDER BY m.source_index), '[]'::jsonb)
  INTO v_clients FROM concierge_request_clients m JOIN clients c ON c.id=m.client_id WHERE m.request_id=p_request_id;
  UPDATE concierge_requests
  SET imported_client_ids = ARRAY(SELECT (value->>'id')::uuid FROM jsonb_array_elements(v_clients)),
      import_summary = jsonb_build_object('input_rows',jsonb_array_length(p_clients),'created',v_created_count,'matched_existing',v_matched_count,'duplicate_existing_client',v_duplicate_count,'row_results',v_results),
      imported_at = now(), updated_at = now()
  WHERE id = p_request_id;
  RETURN jsonb_build_object('input_rows',jsonb_array_length(p_clients),'created',v_created_count,'matched_existing',v_matched_count,'duplicate_existing_client',v_duplicate_count,'row_results',v_results,'clients',v_clients);
END;
$$;

CREATE OR REPLACE FUNCTION concierge_schedule_first_week(p_request_id uuid, p_operator_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_request concierge_requests%ROWTYPE;
  v_client clients%ROWTYPE;
  v_start date;
  v_end date;
  v_date date;
  v_time time;
  v_job_id uuid;
  v_job_snapshot jsonb;
  v_jobs jsonb := '[]'::jsonb;
  v_created integer := 0;
  v_skipped integer := 0;
  v_retry integer;
  v_constraint text;
  v_failed_slots text[] := '{}';
BEGIN
  IF current_setting('request.jwt.claim.role', true) IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'service role required' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_request FROM concierge_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'request not found' USING ERRCODE = 'P0002'; END IF;
  IF v_request.status <> 'importing' THEN RAISE EXCEPTION 'request must be importing' USING ERRCODE = '22023'; END IF;
  IF cardinality(v_request.imported_client_ids) = 0 THEN RAISE EXCEPTION 'import clients first' USING ERRCODE = '22023'; END IF;
  IF v_request.scheduled_at IS NOT NULL THEN
    RETURN jsonb_build_object('jobs', COALESCE(v_request.schedule_summary->'jobs', '[]'::jsonb), 'skipped', COALESCE((v_request.schedule_summary->>'skipped_existing')::integer, 0), 'schedule_summary', v_request.schedule_summary, 'already_complete', true);
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_request.user_id::text, 0));
  v_start := (now() AT TIME ZONE v_request.business_timezone)::date;
  v_end := v_start + 6;
  FOR v_client IN SELECT * FROM clients WHERE id = ANY(v_request.imported_client_ids) AND user_id = v_request.user_id ORDER BY concierge_source_index LOOP
    IF EXISTS (SELECT 1 FROM jobs WHERE user_id = v_request.user_id AND client_id = v_client.id AND status IN ('scheduled', 'in_progress') AND scheduled_date BETWEEN v_start AND v_end) THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;
    IF EXISTS (SELECT 1 FROM jobs WHERE concierge_request_id = p_request_id AND client_id = v_client.id) THEN
      RAISE EXCEPTION 'existing concierge job conflict for client %', v_client.id USING ERRCODE = '23505';
    END IF;
    v_retry := 0;
    LOOP
      SELECT slot_date, slot_time INTO v_date, v_time
      FROM (
        SELECT (v_start + day_offset)::date AS slot_date, make_time(hour_value, 0, 0) AS slot_time
        FROM generate_series(0, 6) AS days(day_offset) CROSS JOIN generate_series(8, 17) AS hours(hour_value)
      ) slots
      WHERE NOT EXISTS (SELECT 1 FROM jobs WHERE user_id = v_request.user_id AND scheduled_date = slots.slot_date AND scheduled_time = slots.slot_time AND status IN ('scheduled', 'in_progress'))
        AND NOT ((slots.slot_date::text || '|' || slots.slot_time::text) = ANY(v_failed_slots))
      ORDER BY slot_date, slot_time LIMIT 1;
      IF v_date IS NULL THEN RAISE EXCEPTION 'not enough first-week schedule slots' USING ERRCODE = '22023'; END IF;
      BEGIN
        INSERT INTO jobs (user_id, client_id, title, scheduled_date, scheduled_time, duration_minutes, status, route_order, recurrence_rule, concierge_request_id)
        VALUES (v_request.user_id, v_client.id, 'Lawn care — ' || v_client.name, v_date, v_time, 60, 'scheduled', 99, 'none', p_request_id)
        RETURNING id INTO v_job_id;
        EXIT;
      EXCEPTION WHEN unique_violation THEN
        GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
        IF v_constraint = 'jobs_concierge_client_unique' THEN RAISE; END IF;
        v_failed_slots := array_append(v_failed_slots, v_date::text || '|' || v_time::text);
        v_retry := v_retry + 1;
        IF v_retry >= 20 THEN RAISE EXCEPTION 'could not reserve a first-week slot after 20 attempts' USING ERRCODE = '40001'; END IF;
        v_date := NULL;
        v_time := NULL;
      END;
    END LOOP;
    v_created := v_created + 1;
    SELECT to_jsonb(j) - 'user_id' - 'concierge_request_id' INTO v_job_snapshot FROM jobs j WHERE j.id = v_job_id;
    v_jobs := v_jobs || jsonb_build_array(jsonb_build_object('id', v_job_id, 'client_id', v_client.id, 'scheduled_date', v_date, 'scheduled_time', v_time, 'snapshot', v_job_snapshot));
  END LOOP;

  UPDATE concierge_requests SET schedule_started_at = COALESCE(schedule_started_at, now()), scheduled_at = now(), scheduled_job_ids = ARRAY(SELECT (value->>'id')::uuid FROM jsonb_array_elements(v_jobs)), schedule_summary = jsonb_build_object('snapshot_version', 1, 'window_start', v_start, 'window_end', v_end, 'created', v_created, 'skipped_existing', v_skipped, 'import', v_request.import_summary, 'jobs', v_jobs), last_operator_id = p_operator_id, updated_at = now() WHERE id = p_request_id;
  RETURN jsonb_build_object('jobs', v_jobs, 'skipped', v_skipped, 'schedule_summary', jsonb_build_object('snapshot_version', 1, 'window_start', v_start, 'window_end', v_end, 'created', v_created, 'skipped_existing', v_skipped, 'import', v_request.import_summary, 'jobs', v_jobs));
END;
$$;

CREATE OR REPLACE FUNCTION concierge_undo_first_week(p_request_id uuid, p_operator_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_request concierge_requests%ROWTYPE;
  v_deleted integer;
  v_remaining uuid[];
BEGIN
  IF current_setting('request.jwt.claim.role', true) IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'service role required' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_request FROM concierge_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'request not found' USING ERRCODE = 'P0002'; END IF;
  IF v_request.status NOT IN ('importing', 'review') THEN RAISE EXCEPTION 'undo is only allowed for an active imported request' USING ERRCODE = '22023'; END IF;
  WITH originals AS (
    SELECT * FROM jsonb_to_recordset(COALESCE(v_request.schedule_summary->'jobs', '[]'::jsonb)) AS x(id uuid, snapshot jsonb)
  ), removed AS (
    DELETE FROM jobs j USING originals o
    WHERE j.id = o.id AND j.user_id = v_request.user_id AND j.concierge_request_id = p_request_id
      AND (to_jsonb(j) - 'user_id' - 'concierge_request_id') = o.snapshot
    RETURNING j.id
  ) SELECT count(*) INTO v_deleted FROM removed;
  SELECT COALESCE(array_agg(id), '{}') INTO v_remaining FROM jobs WHERE id = ANY(v_request.scheduled_job_ids) AND concierge_request_id = p_request_id;
  UPDATE concierge_requests SET scheduled_job_ids = v_remaining, schedule_summary = schedule_summary || jsonb_build_object('undo_at', now(), 'undo_deleted', v_deleted, 'undo_retained_changed', cardinality(v_remaining)), schedule_started_at = CASE WHEN cardinality(v_remaining) = 0 THEN NULL ELSE schedule_started_at END, scheduled_at = CASE WHEN cardinality(v_remaining) = 0 THEN NULL ELSE scheduled_at END, last_operator_id = p_operator_id, updated_at = now() WHERE id = p_request_id;
  RETURN jsonb_build_object('deleted', v_deleted, 'retained_changed', cardinality(v_remaining), 'success', true);
END;
$$;

CREATE OR REPLACE FUNCTION concierge_record_review(p_request_id uuid, p_checklist jsonb, p_notes text, p_operator_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_request concierge_requests%ROWTYPE;
BEGIN
  IF current_setting('request.jwt.claim.role', true) IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'service role required' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_request FROM concierge_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'request not found' USING ERRCODE = 'P0002'; END IF;
  IF v_request.status = 'review' THEN RETURN to_jsonb(v_request); END IF;
  IF v_request.status <> 'importing' OR cardinality(v_request.imported_client_ids) = 0 OR v_request.scheduled_at IS NULL THEN RAISE EXCEPTION 'request is not ready for review' USING ERRCODE = '22023'; END IF;
  IF NOT (p_checklist @> '{"clients_verified":true,"first_week_verified":true,"customer_ready":true}'::jsonb) THEN RAISE EXCEPTION 'operator checklist is incomplete' USING ERRCODE = '22023'; END IF;
  IF COALESCE((v_request.schedule_summary->>'created')::integer, 0) = 0 AND COALESCE((v_request.schedule_summary->>'skipped_existing')::integer, 0) > 0 AND NOT (p_checklist @> '{"existing_schedule_verified":true}'::jsonb) THEN RAISE EXCEPTION 'existing schedule verification is required' USING ERRCODE = '22023'; END IF;
  UPDATE concierge_requests SET status='review', review_started_at=now(), operator_checklist=p_checklist, notes=left(COALESCE(p_notes,''),4000), last_operator_id=p_operator_id, updated_at=now() WHERE id=p_request_id RETURNING * INTO v_request;
  RETURN to_jsonb(v_request);
END;
$$;

CREATE OR REPLACE FUNCTION concierge_complete_review(p_request_id uuid, p_operator_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_request concierge_requests%ROWTYPE;
BEGIN
  IF current_setting('request.jwt.claim.role', true) IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'service role required' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_request FROM concierge_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'request not found' USING ERRCODE = 'P0002'; END IF;
  IF v_request.status = 'done' THEN RETURN to_jsonb(v_request); END IF;
  IF v_request.status <> 'review' OR NOT (v_request.operator_checklist @> '{"clients_verified":true,"first_week_verified":true,"customer_ready":true}'::jsonb) THEN RAISE EXCEPTION 'completed human review is required' USING ERRCODE = '22023'; END IF;
  IF COALESCE((v_request.schedule_summary->>'created')::integer, 0) = 0 AND COALESCE((v_request.schedule_summary->>'skipped_existing')::integer, 0) > 0 AND NOT (v_request.operator_checklist @> '{"existing_schedule_verified":true}'::jsonb) THEN RAISE EXCEPTION 'existing schedule verification is required' USING ERRCODE = '22023'; END IF;
  UPDATE concierge_requests SET status='done', reviewed_at=now(), done_at=now(), last_operator_id=p_operator_id, updated_at=now() WHERE id=p_request_id RETURNING * INTO v_request;
  RETURN to_jsonb(v_request);
END;
$$;

CREATE OR REPLACE FUNCTION concierge_skip_request(p_request_id uuid, p_notes text, p_operator_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_request concierge_requests%ROWTYPE;
  v_notes text;
BEGIN
  IF current_setting('request.jwt.claim.role', true) IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'service role required' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_request FROM concierge_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'request not found' USING ERRCODE = 'P0002'; END IF;
  IF v_request.status = 'skipped' THEN RETURN to_jsonb(v_request); END IF;
  IF v_request.status NOT IN ('pending', 'importing', 'review') THEN RAISE EXCEPTION 'request cannot be skipped from its current state' USING ERRCODE = '22023'; END IF;
  IF v_request.scheduled_at IS NOT NULL
    OR cardinality(v_request.scheduled_job_ids) > 0
    OR EXISTS (SELECT 1 FROM jobs WHERE concierge_request_id = p_request_id)
  THEN RAISE EXCEPTION 'request schedule must be fully undone before skip' USING ERRCODE = '22023'; END IF;
  v_notes := btrim(COALESCE(p_notes,''));
  IF char_length(v_notes) NOT BETWEEN 1 AND 4000 THEN RAISE EXCEPTION 'operator notes must be 1 to 4000 characters' USING ERRCODE = '22023'; END IF;
  UPDATE concierge_requests SET status='skipped', skipped_at=now(), skip_notes=v_notes, skipped_by_operator_id=p_operator_id, last_operator_id=p_operator_id, updated_at=now() WHERE id=p_request_id RETURNING * INTO v_request;
  RETURN to_jsonb(v_request);
END;
$$;

REVOKE ALL ON FUNCTION concierge_import_clients(uuid, jsonb, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION check_concierge_submit_rate_limit(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION concierge_schedule_first_week(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION concierge_undo_first_week(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION concierge_record_review(uuid, jsonb, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION concierge_complete_review(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION concierge_skip_request(uuid, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION concierge_import_clients(uuid, jsonb, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION check_concierge_submit_rate_limit(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION concierge_schedule_first_week(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION concierge_undo_first_week(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION concierge_record_review(uuid, jsonb, text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION concierge_complete_review(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION concierge_skip_request(uuid, text, uuid) TO service_role;

-- Customer reads use a deliberately narrow RPC so a PostgREST select=* cannot
-- expose uploaded CSV data, operator notes/checklists, or operator identities.
-- Admin reads and all mutations continue to use the service role, which keeps
-- its direct table access and bypasses RLS.
DROP POLICY IF EXISTS "Concierge: owner select own" ON concierge_requests;
REVOKE SELECT ON TABLE concierge_requests FROM anon, authenticated;
GRANT ALL ON TABLE concierge_requests TO service_role;

CREATE OR REPLACE FUNCTION get_my_concierge_request()
RETURNS TABLE (
  id uuid,
  status text,
  tier_at_request text,
  submitted_at timestamptz,
  sla_due_at timestamptz,
  review_started_at timestamptz,
  reviewed_at timestamptz,
  done_at timestamptz,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    cr.id,
    cr.status,
    cr.tier_at_request,
    cr.submitted_at,
    cr.sla_due_at,
    cr.review_started_at,
    cr.reviewed_at,
    cr.done_at,
    cr.created_at
  FROM concierge_requests cr
  WHERE cr.user_id = auth.uid()
  ORDER BY cr.created_at DESC
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION get_my_concierge_request() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION get_my_concierge_request() TO authenticated;
