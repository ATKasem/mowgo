-- Profitability tracking
-- Adds cost tracking fields to jobs + profiles so every job can show
-- estimated profit = rate - (miles × cost_per_mile + materials_cost + hours × labor_cost)

-- 1. Cost fields on jobs
ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS materials_cost DECIMAL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS travel_miles INTEGER DEFAULT 0;

-- 2. Configurable cost rates on the owner profile
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS cost_per_mile DECIMAL DEFAULT 0.70,
  ADD COLUMN IF NOT EXISTS hourly_labor_cost DECIMAL DEFAULT 25.00;

-- 3. RPC: calculate estimated profit for a single job
CREATE OR REPLACE FUNCTION estimated_job_profit(p_job_id UUID)
RETURNS TABLE (
  job_id UUID,
  revenue DECIMAL,
  materials_cost DECIMAL,
  travel_cost DECIMAL,
  labor_cost DECIMAL,
  estimated_profit DECIMAL,
  profit_margin_percent DECIMAL
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_job RECORD;
  v_client_rate DECIMAL;
  v_cost_per_mile DECIMAL;
  v_hourly_labor DECIMAL;
  v_hours DECIMAL;
BEGIN
  SELECT j.*, c.rate INTO v_job
  FROM jobs j
  LEFT JOIN clients c ON c.id = j.client_id
  WHERE j.id = p_job_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  v_client_rate := COALESCE(v_job.rate, 0);
  v_cost_per_mile := COALESCE(
    (SELECT cost_per_mile FROM profiles WHERE id = v_job.user_id),
    0.70
  );
  v_hourly_labor := COALESCE(
    (SELECT hourly_labor_cost FROM profiles WHERE id = v_job.user_id),
    25.00
  );
  v_hours := COALESCE(v_job.duration_minutes, 60) / 60.0;

  job_id := p_job_id;
  revenue := v_client_rate;
  materials_cost := COALESCE(v_job.materials_cost, 0);
  travel_cost := COALESCE(v_job.travel_miles, 0) * v_cost_per_mile;
  labor_cost := v_hours * v_hourly_labor;
  estimated_profit := v_client_rate - COALESCE(v_job.materials_cost, 0) - (COALESCE(v_job.travel_miles, 0) * v_cost_per_mile) - (v_hours * v_hourly_labor);

  IF v_client_rate > 0 THEN
    profit_margin_percent := ROUND((estimated_profit / v_client_rate) * 100, 1);
  ELSE
    profit_margin_percent := 0;
  END IF;

  RETURN NEXT;
END;
$$;

-- 4. RPC: profitability summary for today or a date range
CREATE OR REPLACE FUNCTION job_profitability_summary(
  p_start_date DATE DEFAULT CURRENT_DATE,
  p_end_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  total_revenue DECIMAL,
  total_materials DECIMAL,
  total_travel_cost DECIMAL,
  total_labor_cost DECIMAL,
  total_profit DECIMAL,
  overall_margin_percent DECIMAL,
  job_count INTEGER
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();

  RETURN QUERY
  SELECT
    COALESCE(SUM(COALESCE(c.rate, 0)), 0)::DECIMAL AS total_revenue,
    COALESCE(SUM(COALESCE(j.materials_cost, 0)), 0)::DECIMAL AS total_materials,
    COALESCE(SUM(COALESCE(j.travel_miles, 0) * COALESCE(p.cost_per_mile, 0.70)), 0)::DECIMAL AS total_travel_cost,
    COALESCE(SUM((COALESCE(j.duration_minutes, 60) / 60.0) * COALESCE(p.hourly_labor_cost, 25.00)), 0)::DECIMAL AS total_labor_cost,
    COALESCE(SUM(
      COALESCE(c.rate, 0)
      - COALESCE(j.materials_cost, 0)
      - (COALESCE(j.travel_miles, 0) * COALESCE(p.cost_per_mile, 0.70))
      - ((COALESCE(j.duration_minutes, 60) / 60.0) * COALESCE(p.hourly_labor_cost, 25.00))
    ), 0)::DECIMAL AS total_profit,
    CASE
      WHEN COALESCE(SUM(COALESCE(c.rate, 0)), 0) > 0
      THEN ROUND(
        (SUM(
          COALESCE(c.rate, 0)
          - COALESCE(j.materials_cost, 0)
          - (COALESCE(j.travel_miles, 0) * COALESCE(p.cost_per_mile, 0.70))
          - ((COALESCE(j.duration_minutes, 60) / 60.0) * COALESCE(p.hourly_labor_cost, 25.00))
        ) / SUM(COALESCE(c.rate, 0))) * 100, 1)
      ELSE 0
    END AS overall_margin_percent,
    COUNT(*)::INTEGER AS job_count
  FROM jobs j
  LEFT JOIN clients c ON c.id = j.client_id
  LEFT JOIN profiles p ON p.id = j.user_id
  WHERE j.user_id = v_user_id
    AND j.status = 'done'
    AND j.scheduled_date >= p_start_date
    AND j.scheduled_date <= p_end_date;
END;
$$;

-- 5. Allow crew to see cost fields (read-only) — owner controls the rates
-- Crew already has SELECT on jobs they're assigned to; cost fields are read-only
-- Only owners can update cost_per_mile and hourly_labor_cost on their profile
CREATE POLICY "Owner can update profitability settings"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);