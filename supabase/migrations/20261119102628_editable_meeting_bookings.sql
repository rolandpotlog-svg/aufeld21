-- Edit in place: retain booking identity, owner and all historical billing evidence.
-- Version matches the successfully applied hosted migration.
grant update(start_at,end_at,note) on public.bookings to authenticated;
create policy "Members can update their own future bookings"
  on public.bookings for update to authenticated
  using (member_id=(select auth.uid()) and public.is_member() and start_at>now())
  with check (member_id=(select auth.uid()) and public.is_member() and start_at>now());

-- Private trigger needs the same privileged quota lookups as the INSERT guard.
-- It is not an RPC and cannot be called directly by browser/service roles.
create function billing_private.guard_booking_update() returns trigger
language plpgsql security definer set search_path='' as $$
declare
  old_month date; new_month date;
  old_account uuid; new_account uuid;
  summary record; member_role text; replaced_hours numeric:=0;
begin
  if auth.uid() is null or old.member_id<>auth.uid() or not public.is_member() then
    raise exception 'booking_owner_required';
  end if;
  if old.start_at<=now() or new.start_at<=now() then raise exception 'booking_already_started'; end if;
  if new.id<>old.id or new.member_id<>old.member_id or new.created_at<>old.created_at then
    raise exception 'booking_identity_immutable';
  end if;
  -- Coordinate with new bookings, package changes and invoice generation.
  perform pg_advisory_xact_lock(21021,720);
  old_month:=date_trunc('month',old.start_at at time zone 'Europe/Vienna')::date;
  new_month:=date_trunc('month',new.start_at at time zone 'Europe/Vienna')::date;
  select account_id into old_account from public.meeting_terms_at(old.member_id,old_month);
  select account_id into new_account from public.meeting_terms_at(new.member_id,new_month);
  if old_account is null or new_account is null then raise exception 'meeting_terms_missing'; end if;
  if new_account<>new.member_id and not exists(select 1 from public.members where id=new_account and active) then
    raise exception 'shared_account_inactive';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(new_account::text,0));
  if exists(select 1 from public.invoice_usage_periods p join public.invoices i on i.id=p.invoice_id
    where i.status<>'cancelled' and ((p.member_id=old_account and p.usage_month=old_month)
      or (p.member_id=new_account and p.usage_month=new_month))) then
    raise exception 'booking_usage_billed';
  end if;
  select role into member_role from public.members where id=new.member_id;
  if member_role='employee' then
    select * into summary from public.meeting_usage(new_month) where member_id=new.member_id;
    if not found then raise exception 'meeting_terms_missing'; end if;
    if old_month=new_month then replaced_hours:=extract(epoch from(old.end_at-old.start_at))/3600; end if;
    -- NULL is the permanent, free/unlimited exemption (including shared logins).
    if summary.included_hours is not null and
      summary.used_hours-replaced_hours+extract(epoch from(new.end_at-new.start_at))/3600>summary.included_hours+summary.bonus_hours then
      raise exception 'employee_quota_exceeded';
    end if;
  end if;
  return new;
end $$;
revoke all on function billing_private.guard_booking_update() from public,anon,authenticated,service_role;
create trigger guard_booking_update before update on public.bookings
  for each row execute function billing_private.guard_booking_update();
-- Existing opening-hours/half-hour/duration/note checks and the GiST exclusion
-- constraint also run on UPDATE and atomically prevent overlapping bookings.
