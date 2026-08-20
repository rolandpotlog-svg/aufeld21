-- Rechnungsnummern zentral und atomar in Postgres vergeben.
-- Damit bleiben Nummern auch bei parallelen Cron-/Admin-Aufrufen eindeutig.

create or replace function public.next_invoice_number(invoice_year integer)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  candidate text;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role'
     and not public.is_admin() then
    raise exception 'admin_required';
  end if;

  loop
    candidate := 'A21-' || invoice_year::text || '-' ||
      lpad(nextval('public.invoice_number_seq')::text, 4, '0');

    exit when not exists (
      select 1
      from public.invoices
      where invoice_number = candidate
    );
  end loop;

  return candidate;
end;
$$;

revoke all on function public.next_invoice_number(integer) from public;
revoke all on function public.next_invoice_number(integer) from anon;
grant execute on function public.next_invoice_number(integer) to authenticated, service_role;

create or replace function public.finalize_invoice(target_invoice_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  generated_number text;
begin
  if not public.is_admin() then
    raise exception 'admin_required';
  end if;

  generated_number := public.next_invoice_number(
    extract(year from current_date)::integer
  );

  update public.invoices
  set status = 'final',
      invoice_number = generated_number,
      finalized_at = now()
  where id = target_invoice_id
    and status = 'draft';

  if not found then
    raise exception 'invoice_not_draft';
  end if;

  return generated_number;
end;
$$;

revoke all on function public.finalize_invoice(uuid) from public;
revoke all on function public.finalize_invoice(uuid) from anon;
grant execute on function public.finalize_invoice(uuid) to authenticated;
