-- Eine stornierte Rechnung bleibt zur Nachvollziehbarkeit erhalten, darf aber
-- eine neue gültige Rechnung für denselben Abrechnungsmonat nicht blockieren.
drop index if exists public.invoices_member_billing_month_idx;

create unique index invoices_member_billing_month_idx
  on public.invoices (member_id, billing_month)
  where status <> 'cancelled';
