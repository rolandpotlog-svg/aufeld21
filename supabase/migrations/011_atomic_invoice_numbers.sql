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
grant execute on function public.next_invoice_number(integer) to authenticated, service_role;

create or replace function public.finalize_invoice(target_invoice_id uuid)
returns public.invoices
language plpgsql
security definer
set search_path = public
as $$
declare
  finalized_invoice public.invoices;
begin
  if not public.is_admin() then
    raise exception 'admin_required';
  end if;

  update public.invoices
  set
    status = 'final',
    invoice_number = coalesce(
      invoice_number,
      public.next_invoice_number(extract(year from current_date)::integer)
    ),
    finalized_at = coalesce(finalized_at, now())
  where id = target_invoice_id
  returning * into finalized_invoice;

  if finalized_invoice.id is null then
    raise exception 'invoice_not_found';
  end if;

  return finalized_invoice;
end;
$$;

revoke all on function public.finalize_invoice(uuid) from public;
grant execute on function public.finalize_invoice(uuid) to authenticated;
