-- Meetingraum: vollständiges Schema für den Supabase SQL Editor
create extension if not exists btree_gist;

create table if not exists public.members (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  name text not null,
  role text not null default 'member' check (role in ('member', 'partner', 'employee', 'admin')),
  plan text not null default 'pro' check (plan in ('pro')),
  active boolean not null default true,
  office_name text,
  billing_name text,
  billing_address text,
  billing_uid text,
  monthly_rent_net numeric(12,2) check (monthly_rent_net is null or monthly_rent_net >= 0),
  contract_start date,
  contract_end date,
  created_at timestamptz not null default now()
);

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  start_at timestamptz not null,
  end_at timestamptz not null,
  note text,
  created_at timestamptz not null default now(),
  constraint bookings_end_after_start check (end_at > start_at),
  constraint bookings_note_length check (note is null or char_length(note) <= 120)
);

alter table public.bookings add constraint bookings_half_hour_slots check (
  extract(minute from start_at at time zone 'Europe/Vienna') in (0, 30)
  and extract(second from start_at at time zone 'Europe/Vienna') = 0
  and extract(minute from end_at at time zone 'Europe/Vienna') in (0, 30)
  and extract(second from end_at at time zone 'Europe/Vienna') = 0
);
alter table public.bookings add constraint bookings_opening_hours check (
  (start_at at time zone 'Europe/Vienna')::date = (end_at at time zone 'Europe/Vienna')::date
  and (start_at at time zone 'Europe/Vienna')::time >= time '07:00'
  and (end_at at time zone 'Europe/Vienna')::time <= time '20:00'
);

create table if not exists public.issue_reports (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  category text not null check (category in ('Kaffee', 'Drucker', 'WLAN', 'Reinigung', 'Technik', 'Sonstiges')),
  note text check (note is null or char_length(note) <= 300),
  status text not null default 'open' check (status in ('open', 'resolved')),
  created_at timestamptz not null default now()
);

create table if not exists public.quota_adjustments (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  hours numeric(6,2) not null check (hours > 0 and mod(hours, 0.5) = 0),
  valid_month date not null check (valid_month = date_trunc('month', valid_month)::date),
  reason text not null default 'Admin-Gutschrift',
  granted_by uuid not null references public.members(id),
  created_at timestamptz not null default now()
);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete restrict,
  invoice_number text unique,
  status text not null default 'draft' check (status in ('draft', 'final', 'paid', 'cancelled')),
  issue_date date not null,
  billing_month date not null check (billing_month = date_trunc('month', billing_month)::date),
  service_period_start date not null,
  service_period_end date not null,
  due_date date not null,
  finalized_at timestamptz,
  paid_at timestamptz,
  created_by uuid not null references public.members(id),
  created_at timestamptz not null default now(),
  constraint invoice_period_valid check (service_period_end >= service_period_start),
  constraint final_invoice_has_number check (status in ('draft', 'cancelled') or invoice_number is not null)
);

create unique index if not exists invoices_member_billing_month_idx
  on public.invoices (member_id, billing_month)
  where status <> 'cancelled';

create table if not exists public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  description text not null,
  quantity numeric(12,2) not null check (quantity > 0),
  unit text not null default 'Stk.',
  unit_price_net numeric(12,2) not null check (unit_price_net >= 0),
  vat_rate numeric(5,2) not null default 20 check (vat_rate >= 0),
  sort_order integer not null default 0
);

create table if not exists public.member_deposits (
  member_id uuid primary key references public.members(id) on delete cascade,
  agreed_amount numeric(12,2) not null default 0 check (agreed_amount >= 0),
  received_amount numeric(12,2) not null default 0 check (received_amount >= 0),
  received_at date,
  returned_amount numeric(12,2) not null default 0 check (returned_amount >= 0),
  returned_at date,
  note text,
  updated_at timestamptz not null default now(),
  updated_by uuid not null references public.members(id)
);

create table if not exists public.member_documents (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  document_type text not null check (document_type in ('mietvertrag', 'hausordnung', 'sonstiges')),
  title text not null,
  storage_path text not null unique,
  visible_to_member boolean not null default true,
  valid_from date,
  valid_until date,
  uploaded_by uuid not null references public.members(id),
  created_at timestamptz not null default now()
);

create index if not exists quota_adjustments_member_month_idx
  on public.quota_adjustments (member_id, valid_month);
create index if not exists invoices_member_issue_date_idx
  on public.invoices (member_id, issue_date desc);
create index if not exists invoice_items_invoice_id_idx
  on public.invoice_items (invoice_id);

alter table public.bookings
  add constraint bookings_no_overlap
  exclude using gist (tstzrange(start_at, end_at, '[)') with &&);

create index if not exists bookings_start_at_idx on public.bookings (start_at);
create index if not exists bookings_member_id_idx on public.bookings (member_id);

alter table public.members enable row level security;
alter table public.bookings enable row level security;
alter table public.issue_reports enable row level security;
alter table public.quota_adjustments enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;
alter table public.member_deposits enable row level security;
alter table public.member_documents enable row level security;

create or replace function public.is_member()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.members
    where id = auth.uid() and active = true
  );
$$;

revoke all on function public.is_member() from public;
grant execute on function public.is_member() to authenticated;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.members
    where id = auth.uid()
      and role = 'admin'
      and active = true
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

create or replace function public.is_billing_member()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
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
  select exists (select 1 from public.members where id = auth.uid() and role in ('member', 'admin') and active = true);
$$;
revoke all on function public.is_tenant() from public;
grant execute on function public.is_tenant() to authenticated;

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
  if member_role <> 'employee' then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(new.member_id::text, 0));
  month_start := date_trunc('month', new.start_at at time zone 'Europe/Vienna') at time zone 'Europe/Vienna';
  month_end := ((date_trunc('month', new.start_at at time zone 'Europe/Vienna') + interval '1 month') at time zone 'Europe/Vienna');

  select coalesce(sum(extract(epoch from (end_at - start_at)) / 3600), 0)
    into used_hours
    from public.bookings
    where member_id = new.member_id
      and start_at >= month_start
      and start_at < month_end;

  select coalesce(sum(hours), 0)
    into bonus_hours
    from public.quota_adjustments
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
create trigger employee_booking_quota
before insert on public.bookings
for each row execute function public.enforce_employee_booking_quota();

create sequence if not exists public.invoice_number_seq;

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

  generated_number := 'A21-' || extract(year from current_date)::text || '-' ||
    lpad(nextval('public.invoice_number_seq')::text, 4, '0');

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
grant execute on function public.finalize_invoice(uuid) to authenticated;

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

create policy "Authenticated members can read members"
  on public.members for select
  to authenticated
  using (public.is_member());

create policy "Authenticated members can read all bookings"
  on public.bookings for select
  to authenticated
  using (public.is_member());

create policy "Members can create their own bookings"
  on public.bookings for insert
  to authenticated
  with check (
    member_id = auth.uid()
    and public.is_member()
  );

create policy "Members can delete their own bookings"
  on public.bookings for delete
  to authenticated
  using (member_id = auth.uid());

create policy "Members can create issue reports"
  on public.issue_reports for insert
  to authenticated
  with check (
    member_id = auth.uid()
    and public.is_member()
  );

create policy "Admins read issue reports"
  on public.issue_reports for select to authenticated
  using (public.is_admin());

create policy "Admins update issue reports"
  on public.issue_reports for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "Members can read own quota adjustments"
  on public.quota_adjustments for select
  to authenticated
  using (member_id = auth.uid() or public.is_admin());

create policy "Admins can create quota adjustments"
  on public.quota_adjustments for insert
  to authenticated
  with check (public.is_admin() and granted_by = auth.uid());

create policy "Members read own invoices and admins read all"
  on public.invoices for select
  to authenticated
  using ((member_id = auth.uid() and public.is_billing_member()) or public.is_admin());

create policy "Admins manage invoice drafts"
  on public.invoices for all
  to authenticated
  using (public.is_admin() and status = 'draft')
  with check (public.is_admin());

create policy "Members read items of visible invoices"
  on public.invoice_items for select
  to authenticated
  using (exists (
    select 1 from public.invoices
    where invoices.id = invoice_items.invoice_id
      and ((invoices.member_id = auth.uid() and public.is_billing_member()) or public.is_admin())
  ));

create policy "Admins manage draft invoice items"
  on public.invoice_items for all
  to authenticated
  using (public.is_admin() and exists (
    select 1 from public.invoices
    where invoices.id = invoice_items.invoice_id
      and invoices.status = 'draft'
  ))
  with check (public.is_admin());

create policy "Members read own deposit and admins read all deposits"
  on public.member_deposits for select to authenticated
  using ((member_id = auth.uid() and public.is_tenant()) or public.is_admin());

create policy "Admins manage deposits"
  on public.member_deposits for all to authenticated
  using (public.is_admin()) with check (public.is_admin() and updated_by = auth.uid());

create policy "Members read own visible documents and admins read all documents"
  on public.member_documents for select to authenticated
  using (
    (member_id = auth.uid() and visible_to_member and (document_type <> 'mietvertrag' or public.is_tenant()))
    or public.is_admin()
  );

create policy "Admins manage documents"
  on public.member_documents for all to authenticated
  using (public.is_admin()) with check (public.is_admin() and uploaded_by = auth.uid());

revoke all on public.members from authenticated;
revoke update on public.bookings from authenticated;
revoke all on public.issue_reports from authenticated;
revoke all on public.quota_adjustments from authenticated;
revoke all on public.invoices from authenticated;
revoke all on public.invoice_items from authenticated;
revoke all on public.member_deposits from authenticated;
revoke all on public.member_documents from authenticated;
grant select (id, email, name, role, plan, active, created_at) on public.members to authenticated;
grant select, insert, delete on public.bookings to authenticated;
grant select, insert, update on public.issue_reports to authenticated;
grant select, insert on public.quota_adjustments to authenticated;
grant select, insert, update, delete on public.invoices to authenticated;
grant select, insert, update, delete on public.invoice_items to authenticated;
grant select, insert, update, delete on public.member_deposits to authenticated;
grant select, insert, update, delete on public.member_documents to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('member-documents', 'member-documents', false, 10485760, array['application/pdf'])
on conflict (id) do update set public = false;

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
          and (document_type <> 'mietvertrag' or public.is_tenant())
      )
    )
  );

create policy "Admins upload member documents"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'member-documents' and public.is_admin());

create policy "Admins delete member documents"
  on storage.objects for delete to authenticated
  using (bucket_id = 'member-documents' and public.is_admin());
