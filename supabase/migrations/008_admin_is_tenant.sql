-- Roland ist zugleich Administrator und regulärer Mieter.
-- Admins behalten alle Verwaltungsrechte und erhalten zusätzlich
-- Zugriff auf ihre eigenen Rechnungen, Mietverträge und Kautionsdaten.

create or replace function public.is_billing_member()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.members
    where id = auth.uid()
      and role in ('member', 'partner', 'admin')
      and active = true
  );
$$;

revoke all on function public.is_billing_member() from public;
grant execute on function public.is_billing_member() to authenticated;

create or replace function public.is_tenant()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.members
    where id = auth.uid()
      and role in ('member', 'admin')
      and active = true
  );
$$;

revoke all on function public.is_tenant() from public;
grant execute on function public.is_tenant() to authenticated;
