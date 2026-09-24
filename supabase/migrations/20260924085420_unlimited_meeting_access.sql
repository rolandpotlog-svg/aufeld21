-- Persistent, account-level exemption: NULL usage allowance means truly unlimited,
-- never a large finite bonus. No existing rent, invoice, item or snapshot is changed.
alter table public.members add column meeting_unlimited boolean not null default false;
comment on column public.members.meeting_unlimited is
  'Permanent unlimited, free meeting-room usage for this billing account. Server-managed; independent of package changes.';

CREATE OR REPLACE FUNCTION public.create_monthly_invoice(target_member_id uuid, target_month date, creator_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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
  usage_summary record;
  terms_summary public.meeting_terms%rowtype;
  extra_hours numeric;
  today date := (now() at time zone 'Europe/Vienna')::date;
  latest_month date := date_trunc('month',today)::date;
begin
  perform pg_advisory_xact_lock(21021,720);
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
  select * into terms_summary from public.meeting_terms_at(tenant.id,target_month);
  if not found then raise exception 'meeting_terms_missing'; end if;
  if terms_summary.account_id<>tenant.id then return jsonb_build_object('created',false,'reason','shared_account'); end if;
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
    case when terms_summary.package='post' then 'Postservice '
      when terms_summary.package='business' then 'Business-Standort inkl. 1 Std. Meetingraum '
      when tenant.role='partner' then 'Flexbüro inkl. '||trim(trailing '.' from trim(trailing '0' from terms_summary.included_hours::text))||' Std. Meetingraum '
      else 'Grundmiete '||coalesce(tenant.office_name,'AUFELD21')||' ' end
    ||to_char(target_month,'YYYY-MM')||case when active_days<>days_in_month then ' (aliquot '||active_days||'/'||days_in_month||' Tage)' else '' end,
    1,'Monat',round(tenant.monthly_rent_net*active_days/days_in_month,2),20,0);
  -- Catch up unbilled completed usage months on the next NEW monthly invoice.
  -- Pre-issued invoices are never amended, renumbered or silently duplicated.
  for usage_month_value in select generate_series(date_trunc('month',tenant.contract_start),target_month-interval '2 months',interval '1 month')::date loop
    if exists(select 1 from public.invoice_usage_periods p join public.invoices i on i.id=p.invoice_id
      where p.member_id=tenant.id and p.usage_month=usage_month_value and i.status<>'cancelled') then continue; end if;
    select * into usage_summary from public.meeting_usage(usage_month_value) where member_id=tenant.id;
    if not found then raise exception 'meeting_terms_missing'; end if;
    -- Shared additional logins consume the owner's allowance and are billed once.
    if usage_summary.account_id<>tenant.id or not usage_summary.billable then continue; end if;
    extra_hours := greatest(usage_summary.used_hours-usage_summary.included_hours-usage_summary.bonus_hours,0);
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
$function$;

CREATE OR REPLACE FUNCTION public.meeting_usage(target_month date)
 RETURNS TABLE(member_id uuid, account_id uuid, package text, included_hours numeric, used_hours numeric, bonus_hours numeric, billable boolean, account_name text)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  with terms as (
    select t.* from public.members m cross join lateral public.meeting_terms_at(m.id,target_month) t
  ), used as (
    select t.account_id,sum(extract(epoch from(b.end_at-b.start_at))/3600) as hours
    from public.bookings b join terms t on t.member_id=b.member_id
    where b.start_at>=(target_month::timestamp at time zone 'Europe/Vienna')
      and b.start_at<((target_month+interval '1 month') at time zone 'Europe/Vienna') group by t.account_id
  ), bonus as (
    select t.account_id,sum(q.hours) as hours from public.quota_adjustments q join terms t on t.member_id=q.member_id
    where q.valid_month=target_month group by t.account_id
  )
  select t.member_id,t.account_id,t.package,case when m.meeting_unlimited then null::numeric else owner.included_hours end,coalesce(u.hours,0),coalesce(b.hours,0),
    (t.member_id=t.account_id and m.role<>'employee' and m.monthly_rent_net is not null and not m.meeting_unlimited),coalesce(m.billing_name,m.name)
  from terms t join terms owner on owner.member_id=t.account_id
  join public.members m on m.id=t.account_id
  left join used u on u.account_id=t.account_id left join bonus b on b.account_id=t.account_id;
$function$;

CREATE OR REPLACE FUNCTION billing_private.enforce_meeting_quota()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare month_value date; account_value uuid; summary record; member_role text;
begin
  -- Serialize first-use/package changes with booking creation as well.
  perform pg_advisory_xact_lock(21021,720);
  month_value:=date_trunc('month',new.start_at at time zone 'Europe/Vienna')::date;
  select account_id into account_value from public.meeting_terms_at(new.member_id,month_value);
  if account_value is null then raise exception 'meeting_terms_missing'; end if;
  if account_value<>new.member_id and not exists(select 1 from public.members where id=account_value and active) then
    raise exception 'shared_account_inactive';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(account_value::text,0));
  select role into member_role from public.members where id=new.member_id;
  if member_role<>'employee' then return new; end if;
  select * into summary from public.meeting_usage(month_value) where member_id=new.member_id;
  if not found then raise exception 'meeting_terms_missing'; end if;
  if summary.included_hours is null then return new; end if;
  if summary.used_hours+extract(epoch from(new.end_at-new.start_at))/3600>summary.included_hours+summary.bonus_hours then
    raise exception 'employee_quota_exceeded';
  end if;
  return new;
end $function$;

-- Preserve existing least-privilege entry points; browsers cannot grant themselves access.
revoke all on function public.meeting_usage(date) from public,anon,authenticated;
grant execute on function public.meeting_usage(date) to service_role;
revoke all on function public.create_monthly_invoice(uuid,date,uuid) from public,anon,authenticated;
grant execute on function public.create_monthly_invoice(uuid,date,uuid) to service_role;
revoke all on function billing_private.enforce_meeting_quota() from public,anon,authenticated,service_role;
