-- Remove default PUBLIC EXECUTE grants on security functions (LOW-4).
-- Postgres grants EXECUTE to PUBLIC by default; these functions are gated
-- internally by auth.uid() IS NULL checks, but explicit revocation makes the
-- boundary deliberate instead of a fragile backstop.
-- Note: must revoke FROM PUBLIC (not just anon) — anon inherits via PUBLIC.
revoke execute on function public.create_invoice_for_job(uuid, numeric) from public;
revoke execute on function public.current_business_id() from public;
revoke execute on function public.handle_new_user() from public;

-- Keep authenticated execution intact.
grant execute on function public.create_invoice_for_job(uuid, numeric) to authenticated;
grant execute on function public.current_business_id() to authenticated;
grant execute on function public.handle_new_user() to authenticated;
