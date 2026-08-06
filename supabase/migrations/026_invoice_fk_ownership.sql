-- Close invoice FK-ownership gap (Claude Code audit MEDIUM-1):
-- RLS only checked auth.uid() = user_id; a caller could INSERT an invoice
-- referencing ANOTHER business's client_id/job_id (UUID leak required), and
-- the invoices_job_id_unique index would permanently block the real owner's
-- auto-invoice (create_invoice_for_job ON CONFLICT resolves to attacker row).
drop policy if exists "Invoices: owner only" on public.invoices;

create policy "Invoices: owner only" on public.invoices
  for all
  using (
    auth.uid() = user_id
    and auth.uid() = current_business_id()
  )
  with check (
    auth.uid() = user_id
    and auth.uid() = current_business_id()
    -- Referenced entities must belong to the caller's own business.
    and client_id in (select id from public.clients where user_id = auth.uid())
    and (
      job_id is null
      or exists (select 1 from public.jobs where id = job_id and user_id = current_business_id())
    )
  );
