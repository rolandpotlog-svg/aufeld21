-- Erlaubt dem Admin, den tatsächlichen Zahlungstag einer Rechnung zu dokumentieren.
drop function if exists public.mark_invoice_paid(uuid);

create or replace function public.mark_invoice_paid(target_invoice_id uuid, target_paid_on date)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'admin_required';
  end if;

  if target_paid_on is null or target_paid_on > (now() at time zone 'Europe/Vienna')::date then
    raise exception 'invalid_payment_date';
  end if;

  update public.invoices
  set status = 'paid',
      paid_at = (target_paid_on::timestamp at time zone 'Europe/Vienna')
  where id = target_invoice_id
    and status = 'final';

  if not found then
    raise exception 'invoice_not_final';
  end if;
end;
$$;

revoke all on function public.mark_invoice_paid(uuid, date) from public;
grant execute on function public.mark_invoice_paid(uuid, date) to authenticated;
