-- Go-live-Härtung: aktive Zugänge, Zeitraster und Adminzugriff auf Meldungen.
create or replace function public.is_member()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members where id = auth.uid() and active = true);
$$;
revoke all on function public.is_member() from public;
grant execute on function public.is_member() to authenticated;

alter table public.bookings drop constraint if exists bookings_half_hour_slots;
alter table public.bookings add constraint bookings_half_hour_slots check (
  extract(minute from start_at at time zone 'Europe/Vienna') in (0, 30)
  and extract(second from start_at at time zone 'Europe/Vienna') = 0
  and extract(minute from end_at at time zone 'Europe/Vienna') in (0, 30)
  and extract(second from end_at at time zone 'Europe/Vienna') = 0
);

alter table public.bookings drop constraint if exists bookings_opening_hours;
alter table public.bookings add constraint bookings_opening_hours check (
  (start_at at time zone 'Europe/Vienna')::date = (end_at at time zone 'Europe/Vienna')::date
  and (start_at at time zone 'Europe/Vienna')::time >= time '07:00'
  and (end_at at time zone 'Europe/Vienna')::time <= time '20:00'
);

drop policy if exists "Admins read issue reports" on public.issue_reports;
create policy "Admins read issue reports"
  on public.issue_reports for select to authenticated using (public.is_admin());

drop policy if exists "Admins update issue reports" on public.issue_reports;
create policy "Admins update issue reports"
  on public.issue_reports for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

grant select, insert, update on public.issue_reports to authenticated;
