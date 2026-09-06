-- Additive rollout: no existing invoice/item/contract is rewritten.
-- Version matches the migration applied through Supabase MCP.
create table public.invoice_snapshots (
  invoice_id uuid primary key references public.invoices(id) on delete restrict,
  recipient_name text not null,
  recipient_address text not null,
  recipient_uid text,
  pdf_version integer not null default 1 check (pdf_version in (1,2)),
  captured_at timestamptz not null default now()
);
alter table public.invoice_snapshots enable row level security;
revoke all on public.invoice_snapshots from anon, authenticated;
grant select on public.invoice_snapshots to authenticated;
grant all on public.invoice_snapshots to service_role;
create policy "Read own invoice snapshot" on public.invoice_snapshots for select to authenticated
  using (exists (select 1 from public.invoices i where i.id = invoice_id));

-- Freeze the currently downloadable recipient data, not a claim about historic originals.
insert into public.invoice_snapshots(invoice_id,recipient_name,recipient_address,recipient_uid)
select i.id,coalesce(m.billing_name,m.name),coalesce(m.billing_address,'Rechnungsadresse nicht hinterlegt'),m.billing_uid
from public.invoices i join public.members m on m.id=i.member_id where i.status <> 'draft';

create function public.capture_invoice_recipient() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if new.status in ('final','paid') then
    insert into public.invoice_snapshots(invoice_id,recipient_name,recipient_address,recipient_uid,pdf_version)
    select new.id,coalesce(m.billing_name,m.name),coalesce(m.billing_address,'Rechnungsadresse nicht hinterlegt'),m.billing_uid,2
    from public.members m where m.id=new.member_id
    on conflict (invoice_id) do nothing;
  end if;
  return new;
end;
$$;
revoke all on function public.capture_invoice_recipient() from public,anon,authenticated;
create trigger capture_invoice_recipient after insert or update of status on public.invoices
  for each row execute function public.capture_invoice_recipient();

create function public.protect_issued_invoice() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if old.status='draft' and new.status in ('final','paid')
     and not exists(select 1 from public.invoice_items where invoice_id=new.id) then
    raise exception 'invoice_items_required';
  end if;
  if old.status <> 'draft' and new.status = 'draft' then
    raise exception 'issued_invoice_immutable';
  end if;
  if old.status <> 'draft' and
    (to_jsonb(new) - array['status','paid_at']) is distinct from (to_jsonb(old) - array['status','paid_at']) then
    raise exception 'issued_invoice_immutable';
  end if;
  return new;
end;
$$;
revoke all on function public.protect_issued_invoice() from public,anon,authenticated;
create trigger protect_issued_invoice before update on public.invoices
  for each row execute function public.protect_issued_invoice();

create function public.protect_invoice_snapshot() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin raise exception 'invoice_snapshot_immutable'; end;
$$;
revoke all on function public.protect_invoice_snapshot() from public,anon,authenticated;
create trigger protect_invoice_snapshot before update or delete on public.invoice_snapshots
  for each row execute function public.protect_invoice_snapshot();

create function public.protect_issued_items() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if exists(select 1 from public.invoices where id=old.invoice_id and status <> 'draft') then
    raise exception 'issued_invoice_items_immutable';
  end if;
  if tg_op='DELETE' then return old; end if;
  if exists(select 1 from public.invoices where id=new.invoice_id and status <> 'draft') then
    raise exception 'issued_invoice_items_immutable';
  end if;
  return new;
end;
$$;
revoke all on function public.protect_issued_items() from public,anon,authenticated;
create trigger protect_issued_items before update or delete on public.invoice_items
  for each row execute function public.protect_issued_items();
-- Direct browser writes are restricted to drafts, including the new target invoice.
drop policy if exists "Admins manage draft invoice items" on public.invoice_items;
create policy "Admins manage draft invoice items" on public.invoice_items for all to authenticated
  using(public.is_admin() and exists(select 1 from public.invoices where id=invoice_id and status='draft'))
  with check(public.is_admin() and exists(select 1 from public.invoices where id=invoice_id and status='draft'));

create table public.invoice_usage_periods (
  member_id uuid not null references public.members(id),
  usage_month date not null check (extract(day from usage_month)=1),
  invoice_id uuid not null references public.invoices(id),
  primary key(member_id,usage_month)
);
alter table public.invoice_usage_periods enable row level security;
revoke all on public.invoice_usage_periods from anon,authenticated;
grant all on public.invoice_usage_periods to service_role;
-- Recognize previously billed extras without changing those invoices.
insert into public.invoice_usage_periods(member_id,usage_month,invoice_id)
select i.member_id,(substring(it.description from 'Meetingraum Zusatznutzung ([0-9]{4}-[0-9]{2})')||'-01')::date,i.id
from public.invoices i join public.invoice_items it on it.invoice_id=i.id
where i.status in ('final','paid') and it.description ~ '^Meetingraum Zusatznutzung [0-9]{4}-(0[1-9]|1[012])'
on conflict do nothing;

create table public.billing_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  created_count integer not null default 0,
  skipped_count integer not null default 0,
  errors jsonb not null default '[]'::jsonb
);
alter table public.billing_runs enable row level security;
revoke all on public.billing_runs from anon,authenticated;
grant select on public.billing_runs to authenticated;
grant all on public.billing_runs to service_role;
create policy "Admins read billing runs" on public.billing_runs for select to authenticated using(public.is_admin());

-- Invoker: only the server service role can call this atomic operation.
create function public.create_monthly_invoice(target_member_id uuid,target_month date,creator_id uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  tenant public.members%rowtype;
  existing_id uuid;
  invoice_id_new uuid := gen_random_uuid();
  number_new text;
  month_end date;
  issue_on date;
  active_start date;
  active_end date;
  active_days integer;
  days_in_month integer;
  item_count integer := 0;
  usage_month_value date;
  used_hours numeric;
  bonus_hours numeric;
  extra_hours numeric;
  today date := (now() at time zone 'Europe/Vienna')::date;
  latest_month date := date_trunc('month',today)::date;
begin
  if not exists(select 1 from public.members where id=creator_id and role='admin' and active) then
    raise exception 'admin_required';
  end if;
  if extract(day from today)>=25 then latest_month := (latest_month+interval '1 month')::date; end if;
  if target_month is null or extract(day from target_month)<>1 or target_month>latest_month then
    raise exception 'invalid_billing_month';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(target_member_id::text,0));
  select id into existing_id from public.invoices where member_id=target_member_id and billing_month=target_month and status<>'cancelled';
  if found then return jsonb_build_object('created',false,'reason','existing','id',existing_id); end if;
  select * into tenant from public.members where id=target_member_id for share;
  if not found or not tenant.active or tenant.role not in ('member','partner','admin') or tenant.monthly_rent_net is null then
    return jsonb_build_object('created',false,'reason','not_billable');
  end if;
  if tenant.contract_start is null or nullif(trim(tenant.billing_address),'') is null or tenant.monthly_rent_net<0 then
    raise exception 'billing_profile_incomplete';
  end if;
  month_end := (target_month+interval '1 month'-interval '1 day')::date;
  issue_on := (target_month-interval '1 month')::date+24;
  active_start := greatest(target_month,tenant.contract_start);
  active_end := least(month_end,coalesce(tenant.contract_end,month_end));
  if active_start>active_end then return jsonb_build_object('created',false,'reason','outside_contract'); end if;
  days_in_month := extract(day from month_end)::integer;
  active_days := active_end-active_start+1;
  -- Snapshot, positions, number and finalization all commit or roll back together.
  insert into public.invoices(id,member_id,status,issue_date,billing_month,service_period_start,service_period_end,due_date,created_by)
  values(invoice_id_new,tenant.id,'draft',issue_on,target_month,active_start,active_end,target_month+9,creator_id);
  insert into public.invoice_items(invoice_id,description,quantity,unit,unit_price_net,vat_rate,sort_order)
  values(invoice_id_new,
    case when tenant.role='partner' then 'Flexbüro inkl. 12 Std. Meetingraum ' else 'Grundmiete '||coalesce(tenant.office_name,'AUFELD21')||' ' end
    ||to_char(target_month,'YYYY-MM')||case when active_days<>days_in_month then ' (aliquot '||active_days||'/'||days_in_month||' Tage)' else '' end,
    1,'Monat',round(tenant.monthly_rent_net*active_days/days_in_month,2),20,0);
  -- Catch up unbilled completed usage months on the next NEW monthly invoice.
  -- Pre-issued invoices are never amended, renumbered or silently duplicated.
  for usage_month_value in select generate_series(date_trunc('month',tenant.contract_start),target_month-interval '2 months',interval '1 month')::date loop
    if exists(select 1 from public.invoice_usage_periods p join public.invoices i on i.id=p.invoice_id
      where p.member_id=tenant.id and p.usage_month=usage_month_value and i.status<>'cancelled') then continue; end if;
    select coalesce(sum(extract(epoch from(end_at-start_at))/3600),0) into used_hours from public.bookings
      where member_id=tenant.id and start_at>=(usage_month_value::timestamp at time zone 'Europe/Vienna')
      and start_at<((usage_month_value+interval '1 month') at time zone 'Europe/Vienna');
    select coalesce(sum(hours),0) into bonus_hours from public.quota_adjustments
      where member_id=tenant.id and valid_month=usage_month_value;
    extra_hours := greatest(used_hours-12-bonus_hours,0);
    if extra_hours>0 then
      item_count := item_count+1;
      insert into public.invoice_items(invoice_id,description,quantity,unit,unit_price_net,vat_rate,sort_order)
      values(invoice_id_new,'Meetingraum Zusatznutzung '||to_char(usage_month_value,'YYYY-MM'),extra_hours,'Std.',12,20,item_count);
      insert into public.invoice_usage_periods(member_id,usage_month,invoice_id) values(tenant.id,usage_month_value,invoice_id_new)
      on conflict(member_id,usage_month) do update set invoice_id=excluded.invoice_id;
    end if;
  end loop;
  number_new := public.next_invoice_number(extract(year from issue_on)::integer);
  update public.invoices set status='final',invoice_number=number_new,finalized_at=now() where id=invoice_id_new;
  return jsonb_build_object('created',true,'id',invoice_id_new,'number',number_new);
end;
$$;
revoke all on function public.create_monthly_invoice(uuid,date,uuid) from public,anon,authenticated;
grant execute on function public.create_monthly_invoice(uuid,date,uuid) to service_role;

-- Finished bookings are billing evidence. Normal users cannot rewrite their history.
drop policy if exists "Members can create their own bookings" on public.bookings;
create policy "Members can create their own bookings" on public.bookings for insert to authenticated
  with check(member_id=auth.uid() and public.is_member() and start_at>now());
drop policy if exists "Members can delete their own bookings" on public.bookings;
create policy "Members can delete their own bookings" on public.bookings for delete to authenticated
  using(member_id=auth.uid() and public.is_member() and start_at>now());
