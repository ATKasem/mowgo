-- Fix prod drift: live profiles.tier DEFAULT was 'solo' (paid features for
-- free on every signup) while the committed schema says 'free'. Commit
-- 5e0e32a (Jul 27) intended this change but it was never applied to prod
-- (supabase CLI history out of sync — 007-018 applied out-of-band).
-- Verified live 2026-08-07: all new users defaulted to 'solo'.
ALTER TABLE public.profiles ALTER COLUMN tier SET DEFAULT 'free';
