-- Web Push for the two explicitly authorized administrators only. No invoice
-- triggers, no tenant push, no backfill. Browser subscription is always opt-in.
create table public.push_recipients (
  member_id uuid primary key references public.members(id) on delete cascade,
  email text not null unique
);
insert into public.push_recipients(member_id,email)
select id,lower(email) from public.members where active and role='admin'
  and lower(email) in ('julia.potlog@gmail.com','roland.potlog@gmail.com');
do $$ begin
  if (select count(*) from public.push_recipients)<>2 then raise exception 'Both authorized admins must exist'; end if;
end $$;

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.push_recipients(member_id) on delete cascade,
  endpoint text not null unique check(length(endpoint)<2048),
  subscription jsonb not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_test_at timestamptz,
  last_success_at timestamptz
);
create index push_subscriptions_member_idx on public.push_subscriptions(member_id);
create table public.push_notifications (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.push_subscriptions(id) on delete cascade,
  issue_id uuid references public.issue_reports(id) on delete cascade,
  is_test boolean not null default false,
  status text not null default 'pending' check(status in ('pending','processing','sent','failed','skipped')),
  created_at timestamptz not null default now(),
  available_at timestamptz not null default now(),
  attempted_at timestamptz,
  attempts integer not null default 0,
  lease_id uuid,
  last_error text,
  check(is_test or issue_id is not null),
  unique(subscription_id,issue_id)
);
create index push_notifications_pending_idx on public.push_notifications(available_at) where status='pending';
create index push_notifications_processing_idx on public.push_notifications(attempted_at) where status='processing';
create index push_notifications_issue_idx on public.push_notifications(issue_id);

alter table public.push_recipients enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.push_notifications enable row level security;
revoke all on public.push_recipients,public.push_subscriptions,public.push_notifications from public,anon,authenticated;
grant all on public.push_recipients,public.push_subscriptions,public.push_notifications to service_role;
create policy "No browser access" on public.push_recipients for all to authenticated using(false) with check(false);
create policy "No browser access" on public.push_subscriptions for all to authenticated using(false) with check(false);
create policy "No browser access" on public.push_notifications for all to authenticated using(false) with check(false);
-- All access goes through authenticated, allowlist-checked server routes.
-- Push endpoints are credentials; never return other devices to another member.

create function public.push_config(candidate jsonb default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare cfg jsonb;
begin
  perform pg_advisory_xact_lock(21021,710);
  select decrypted_secret::jsonb into cfg from vault.decrypted_secrets where name='aufeld21_web_push_config';
  if cfg is null and candidate is not null then
    if not coalesce((candidate->>'publicKey') ~ '^[A-Za-z0-9_-]{87}$'
      and (candidate->>'privateKey') ~ '^[A-Za-z0-9_-]{43}$'
      and (candidate->>'dispatchSecret') ~ '^[A-Za-z0-9_-]{43}$',false) then raise exception 'Invalid push configuration'; end if;
    perform vault.create_secret(candidate::text,'aufeld21_web_push_config','Web Push VAPID and signed dispatcher; server only');
    cfg:=candidate;
  end if;
  return cfg;
end $$;
revoke all on function public.push_config(jsonb) from public,anon,authenticated;
grant execute on function public.push_config(jsonb) to service_role;

create function public.push_register(target_member uuid,sub jsonb) returns uuid
language plpgsql security invoker set search_path='' as $$
declare result uuid; owner_id uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended(target_member::text,0));
  if not exists(select 1 from public.push_recipients p join public.members m on m.id=p.member_id
    where m.id=target_member and m.active and m.role='admin' and lower(m.email)=p.email) then
    raise exception 'Push not authorized';
  end if;
  select member_id into owner_id from public.push_subscriptions where endpoint=sub->>'endpoint';
  if owner_id is not null and owner_id<>target_member then raise exception 'Device belongs to another account'; end if;
  if owner_id is null and (select count(*) from public.push_subscriptions where member_id=target_member and active)>=10 then
    raise exception 'Device limit reached';
  end if;
  insert into public.push_subscriptions(member_id,endpoint,subscription) values(target_member,sub->>'endpoint',sub)
    on conflict(endpoint) do update set subscription=excluded.subscription,active=true,updated_at=now()
    returning id into result;
  return result;
end $$;
revoke all on function public.push_register(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.push_register(uuid,jsonb) to service_role;

create function notification_private.enqueue_push() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  insert into public.push_notifications(subscription_id,issue_id)
    select s.id,new.id from public.push_subscriptions s
    join public.push_recipients p on p.member_id=s.member_id join public.members m on m.id=p.member_id
    where s.active and m.active and m.role='admin' and lower(m.email)=p.email
    on conflict(subscription_id,issue_id) do nothing;
  return new;
end $$;
revoke all on function notification_private.enqueue_push() from public,anon,authenticated,service_role;
create trigger issue_push_after_insert after insert on public.issue_reports
  for each row execute function notification_private.enqueue_push();

create function public.push_claim() returns table(job_id uuid,lease uuid,subscription_id uuid,subscription jsonb,issue_id uuid,is_test boolean)
language plpgsql security invoker set search_path='' as $$
begin
  update public.push_notifications n set status='pending',lease_id=null
    where n.status='processing' and n.attempted_at<now()-interval '2 minutes' and n.attempts<3;
  update public.push_notifications n set status='failed',last_error='Push-Zeitlimit oder maximale Versuche erreicht.'
    where n.status in ('pending','processing') and (n.created_at<now()-interval '1 day'
      or (n.attempts>=3 and n.attempted_at<now()-interval '2 minutes'));
  update public.push_notifications n set status='skipped',last_error='Gerät/Zugang deaktiviert oder Meldung bereits erledigt.'
    where n.status='pending' and not exists(
      select 1 from public.push_subscriptions s join public.push_recipients p on p.member_id=s.member_id
      join public.members m on m.id=p.member_id where s.id=n.subscription_id and s.active and m.active and m.role='admin'
      and lower(m.email)=p.email and (n.is_test or exists(select 1 from public.issue_reports r where r.id=n.issue_id and r.status='open')));
  return query with candidates as (
    select n.id from public.push_notifications n where n.status='pending' and n.available_at<=now()
      order by n.created_at for update skip locked limit 10
  ), claimed as (
    update public.push_notifications n set status='processing',attempted_at=now(),attempts=n.attempts+1,lease_id=gen_random_uuid()
      from candidates c where n.id=c.id returning n.*
  ) select c.id,c.lease_id,s.id,s.subscription,c.issue_id,c.is_test
    from claimed c join public.push_subscriptions s on s.id=c.subscription_id;
end $$;
revoke all on function public.push_claim() from public,anon,authenticated;
grant execute on function public.push_claim() to service_role;

create function public.push_finish(target_job uuid,target_lease uuid,outcome text) returns void
language plpgsql security invoker set search_path='' as $$
declare job public.push_notifications%rowtype;
begin
  select * into job from public.push_notifications where id=target_job and lease_id=target_lease and status='processing' for update;
  if not found then return; end if;
  if outcome='gone' then update public.push_subscriptions set active=false,updated_at=now() where id=job.subscription_id; end if;
  if outcome='sent' then update public.push_subscriptions set last_success_at=now() where id=job.subscription_id; end if;
  update public.push_notifications set status=case when outcome='sent' then 'sent' when outcome='gone' then 'skipped'
      when outcome='retry' and attempts<3 then 'pending' else 'failed' end,
    available_at=now()+interval '5 minutes',lease_id=null,
    last_error=case when outcome='sent' then null when outcome='gone' then 'Gerätefreigabe ist abgelaufen.'
      when outcome='retry' then 'Pushdienst vorübergehend nicht erreichbar.' else 'Pushdienst hat die Nachricht nicht angenommen.' end
    where id=job.id;
end $$;
revoke all on function public.push_finish(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.push_finish(uuid,uuid,text) to service_role;

create function public.push_test(target_member uuid,target_endpoint text) returns uuid
language plpgsql security invoker set search_path='' as $$
declare sub_id uuid; result uuid;
begin
  update public.push_subscriptions s set last_test_at=now() where s.member_id=target_member and s.endpoint=target_endpoint and s.active
    and (s.last_test_at is null or s.last_test_at<now()-interval '1 minute')
    and exists(select 1 from public.push_recipients p join public.members m on m.id=p.member_id
      where p.member_id=target_member and m.active and m.role='admin' and lower(m.email)=p.email)
    returning s.id into sub_id;
  if sub_id is null then return null; end if;
  insert into public.push_notifications(subscription_id,is_test) values(sub_id,true) returning id into result;
  return result;
end $$;
revoke all on function public.push_test(uuid,text) from public,anon,authenticated;
grant execute on function public.push_test(uuid,text) to service_role;

-- Only a timestamp and HMAC cross pg_net, never the VAPID private key or a
-- reusable server credential. Requests expire after 90 seconds at the receiver.
create function notification_private.dispatch_push() returns void
language plpgsql security invoker set search_path='' as $$
declare cfg jsonb; stamp text;
begin
  if not pg_try_advisory_xact_lock(21021,711) then return; end if;
  if not exists(select 1 from public.push_notifications where
    (status='pending' and available_at<=now()) or (status='processing' and attempted_at<now()-interval '2 minutes')) then return; end if;
  select decrypted_secret::jsonb into cfg from vault.decrypted_secrets where name='aufeld21_web_push_config';
  if cfg is null then return; end if;
  stamp:=floor(extract(epoch from now()))::bigint::text;
  perform net.http_post(url:='https://www.aufeld21.at/api/cron/push',body:=jsonb_build_object('timestamp',stamp),
    headers:=jsonb_build_object('Content-Type','application/json','X-Push-Signature',
      encode(extensions.hmac(stamp,cfg->>'dispatchSecret','sha256'),'hex')),timeout_milliseconds:=50000);
end $$;
revoke all on function notification_private.dispatch_push() from public,anon,authenticated,service_role;
select cron.schedule('aufeld21-admin-push','* * * * *','select notification_private.dispatch_push()');
