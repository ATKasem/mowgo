-- Waitlist table for hype / founder's rate signups
-- Public insert allowed (no auth needed), only service_role can read

CREATE TABLE IF NOT EXISTS public.waitlist (
    id BIGSERIAL PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    name TEXT,
    phone TEXT,
    source TEXT DEFAULT 'landing',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    converted_to_user BOOLEAN DEFAULT FALSE,
    converted_at TIMESTAMPTZ
);

-- Index for counter queries
CREATE INDEX IF NOT EXISTS idx_waitlist_created_at ON public.waitlist(created_at DESC);

-- RLS: allow public inserts, only owner can read
ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;

-- Anyone can insert (public waitlist form)
CREATE POLICY waitlist_insert_public ON public.waitlist
    FOR INSERT
    WITH CHECK (true);

-- Only service_role can select/update
CREATE POLICY waitlist_select_service ON public.waitlist
    FOR SELECT
    USING (auth.role() = 'service_role');

CREATE POLICY waitlist_update_service ON public.waitlist
    FOR UPDATE
    USING (auth.role() = 'service_role');