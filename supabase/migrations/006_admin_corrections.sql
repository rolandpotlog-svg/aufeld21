-- Sichere Admin-Korrekturen für Zahlungen und Rechnungen.
alter table public.invoices drop constraint if exists final_invoice_has_number;
alter table public.invoices add constraint final_invoice_has_number
  check (status in ('draft', 'cancelled') or invoice_number is not null);

create or replace function public.undo_invoice_payment(target_invoice_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admin_required'; end if;
  update public.invoices set status = 'final', paid_at = null
  where id = target_invoice_id and status = 'paid';
  if not found then raise exception 'invoice_not_paid'; end if;
end;
$$;
revoke all on function public.undo_invoice_payment(uuid) from public;
grant execute on function public.undo_invoice_payment(uuid) to authenticated;

create or replace function public.cancel_invoice(target_invoice_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admin_required'; end if;
  update public.invoices set status = 'cancelled'
  where id = target_invoice_id and status in ('draft', 'final');
  if not found then raise exception 'invoice_not_cancellable'; end if;
end;
$$;
revoke all on function public.cancel_invoice(uuid) from public;
grant execute on function public.cancel_invoice(uuid) to authenticated;
