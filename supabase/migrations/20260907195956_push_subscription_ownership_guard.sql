-- Preserve endpoint ownership even when two accounts register concurrently.
-- Reactivated devices count toward the same ten-device limit as new devices.
create or replace function public.push_register(target_member uuid,sub jsonb) returns uuid
language plpgsql security invoker set search_path='' as $$
declare result uuid; owner_id uuid; was_active boolean;
begin
  perform pg_advisory_xact_lock(hashtextextended(target_member::text,0));
  if not exists(select 1 from public.push_recipients p join public.members m on m.id=p.member_id
    where m.id=target_member and m.active and m.role='admin' and lower(m.email)=p.email) then
    raise exception 'Push not authorized';
  end if;
  select member_id,active into owner_id,was_active from public.push_subscriptions where endpoint=sub->>'endpoint';
  if owner_id is not null and owner_id<>target_member then raise exception 'Device belongs to another account'; end if;
  if not coalesce(was_active,false) and (select count(*) from public.push_subscriptions where member_id=target_member and active)>=10 then
    raise exception 'Device limit reached';
  end if;
  insert into public.push_subscriptions(member_id,endpoint,subscription) values(target_member,sub->>'endpoint',sub)
    on conflict(endpoint) do update set subscription=excluded.subscription,active=true,updated_at=now()
    where public.push_subscriptions.member_id=target_member
    returning id into result;
  if result is null then raise exception 'Device belongs to another account'; end if;
  return result;
end $$;
revoke all on function public.push_register(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.push_register(uuid,jsonb) to service_role;
