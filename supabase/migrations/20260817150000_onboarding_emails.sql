-- Onboarding email tracking — one row per sent email per user
CREATE TABLE IF NOT EXISTS public.onboarding_emails (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    step TEXT NOT NULL, -- 'day1_welcome', 'day2_no_client', 'day3_no_job', 'day7_no_invoice'
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_onboarding_user_step ON public.onboarding_emails(user_id, step);
CREATE INDEX IF NOT EXISTS idx_onboarding_created ON public.onboarding_emails(created_at DESC);

ALTER TABLE public.onboarding_emails ENABLE ROW LEVEL SECURITY;

-- Only service_role can read/write
CREATE POLICY onboarding_emails_service ON public.onboarding_emails
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');