-- Ergänzt bestehende Installationen um Mitarbeiter-Logins ohne Abrechnungszugriff.
alter table public.members drop constraint if exists members_role_check;
alter table public.members
  add constraint members_role_check check (role in ('member', 'employee', 'admin'));

create or replace function public.is_billing_member()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.members
    where id = auth.uid() and role = 'member' and active = true
  );
$$;
revoke all on function public.is_billing_member() from public;
grant execute on function public.is_billing_member() to authenticated;

create or replace function public.enforce_employee_booking_quota()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  member_role text;
  month_start timestamptz;
  month_end timestamptz;
  used_hours numeric;
  bonus_hours numeric;
  requested_hours numeric;
begin
  select role into member_role from public.members where id = new.member_id and active = true;
  if member_role <> 'employee' then return new; end if;
  perform pg_advisory_xact_lock(hashtextextended(new.member_id::text, 0));
  month_start := date_trunc('month', new.start_at at time zone 'Europe/Vienna') at time zone 'Europe/Vienna';
  month_end := ((date_trunc('month', new.start_at at time zone 'Europe/Vienna') + interval '1 month') at time zone 'Europe/Vienna');
  select coalesce(sum(extract(epoch from (end_at - start_at)) / 3600), 0)
    into used_hours from public.bookings
    where member_id = new.member_id and start_at >= month_start and start_at < month_end;
  select coalesce(sum(hours), 0)
    into bonus_hours from public.quota_adjustments
    where member_id = new.member_id
      and valid_month = (month_start at time zone 'Europe/Vienna')::date;
  requested_hours := extract(epoch from (new.end_at - new.start_at)) / 3600;
  if used_hours + requested_hours > 12 + bonus_hours then
    raise exception using errcode = 'P0001', message = 'employee_quota_exceeded';
  end if;
  return new;
end;
$$;
drop trigger if exists employee_booking_quota on public.bookings;
create trigger employee_booking_quota before insert on public.bookings
for each row execute function public.enforce_employee_booking_quota();

drop policy if exists "Members read own invoices and admins read all" on public.invoices;
create policy "Members read own invoices and admins read all"
  on public.invoices for select to authenticated
  using ((member_id = auth.uid() and public.is_billing_member()) or public.is_admin());

drop policy if exists "Members read items of visible invoices" on public.invoice_items;
create policy "Members read items of visible invoices"
  on public.invoice_items for select to authenticated
  using (exists (
    select 1 from public.invoices
    where invoices.id = invoice_items.invoice_id
      and ((invoices.member_id = auth.uid() and public.is_billing_member()) or public.is_admin())
  ));

drop policy if exists "Members read own deposit and admins read all deposits" on public.member_deposits;
create policy "Members read own deposit and admins read all deposits"
  on public.member_deposits for select to authenticated
  using ((member_id = auth.uid() and public.is_billing_member()) or public.is_admin());

drop policy if exists "Members read own visible documents and admins read all documents" on public.member_documents;
create policy "Members read own visible documents and admins read all documents"
  on public.member_documents for select to authenticated
  using (
    (member_id = auth.uid() and visible_to_member and (document_type <> 'mietvertrag' or public.is_billing_member()))
    or public.is_admin()
  );

drop policy if exists "Members download own documents and admins download all" on storage.objects;
create policy "Members download own documents and admins download all"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'member-documents'
    and (
      public.is_admin()
      or exists (
        select 1 from public.member_documents
        where storage_path = name
          and member_id = auth.uid()
          and visible_to_member
          and (document_type <> 'mietvertrag' or public.is_billing_member())
      )
    )
  );
