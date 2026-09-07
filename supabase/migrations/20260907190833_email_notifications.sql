-- New events only: no backfill and no changes to existing invoices or reports.
create extension if not exists pg_net;
create extension if not exists pg_cron with schema pg_catalog;
create schema if not exists notification_private;
revoke all on schema notification_private from public, anon, authenticated;
-- Best-effort hardening for self-hosted PostgreSQL. On hosted Supabase these
-- objects belong to supabase_admin and these REVOKEs can be no-ops. The actual
-- client boundary there is the unexposed net schema and NOLOGIN client roles.
-- Never expose net through the Data API or add a public SQL/queue-reading RPC.
revoke all on schema net from public, anon, authenticated;
revoke all on all tables in schema net from public, anon, authenticated;
revoke all on all functions in schema net from public, anon, authenticated;

create table public.email_notification_settings (
  id boolean primary key default true check (id),
  enabled boolean not null default false,
  last_run_at timestamptz,
  last_error text,
  daily_limit integer not null default 70 check (daily_limit between 1 and 70),
  monthly_limit integer not null default 2500 check (monthly_limit between 1 and 2500)
);
insert into public.email_notification_settings(id) values(true);

create table public.email_notifications (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('invoice','issue')),
  source_id uuid not null,
  recipient_id uuid references public.members(id) on delete set null,
  recipient_email text not null,
  payload jsonb not null,
  status text not null default 'pending' check (status in ('pending','processing','accepted','failed','review','skipped')),
  created_at timestamptz not null default now(),
  available_at timestamptz not null default now(),
  first_attempt_at timestamptz,
  last_attempt_at timestamptz,
  attempts integer not null default 0,
  request_id bigint,
  provider_id text,
  accepted_at timestamptz,
  last_error text,
  uncertain_delivery boolean not null default false,
  unique(kind, source_id)
);
create index email_notifications_pending_idx on public.email_notifications(available_at,created_at) where status='pending';
create index email_notifications_processing_idx on public.email_notifications(last_attempt_at) where status='processing';
create index email_notifications_recipient_idx on public.email_notifications(recipient_id);
create index email_notifications_attempt_idx on public.email_notifications(first_attempt_at) where first_attempt_at is not null;

alter table public.email_notifications enable row level security;
alter table public.email_notification_settings enable row level security;
revoke all on public.email_notifications, public.email_notification_settings from public, anon, authenticated;
grant select on public.email_notifications, public.email_notification_settings to authenticated;
grant all on public.email_notifications, public.email_notification_settings to service_role;
create policy "Active admins read email log" on public.email_notifications for select to authenticated
  using (exists(select 1 from public.members m where m.id=(select auth.uid()) and m.active and m.role='admin'));
create policy "Active admins read email settings" on public.email_notification_settings for select to authenticated
  using (exists(select 1 from public.members m where m.id=(select auth.uid()) and m.active and m.role='admin'));

-- This private trigger is privileged only to enqueue a notification for an already
-- authorized source write. It cannot be called through the Data API.
create function notification_private.enqueue_email() returns trigger
language plpgsql security definer set search_path='' as $$
declare recipient public.members%rowtype; message text; subject_line text; ready_at timestamptz:=now();
begin
  if TG_TABLE_NAME='invoices' then
    if new.status not in ('final','paid') or new.invoice_number is null then return new; end if;
    if TG_OP='UPDATE' and old.status <> 'draft' then return new; end if;
    select * into recipient from public.members where id=new.member_id and active and role<>'employee';
    if not found then return new; end if;
    subject_line := 'AUFELD21: Deine neue Rechnung ist verfügbar';
    message := E'Hallo,\n\ndeine neue Rechnung ' || new.invoice_number || E' ist im AUFELD21-Portal hinterlegt.\n'
      || 'Zeitraum: ' || to_char(new.service_period_start,'DD.MM.YYYY') || ' bis ' || to_char(new.service_period_end,'DD.MM.YYYY')
      || E'\nZahlbar bis: ' || to_char(new.due_date,'DD.MM.YYYY')
      || E'\n\nRechnung ansehen und herunterladen:\nhttps://www.aufeld21.at/portal\n\nBitte melde dich mit deiner freigeschalteten E-Mail-Adresse an. Bereits bezahlte Rechnungen bitte nicht erneut bezahlen.\n\nLiebe Grüße\nJulia & Roland\nAUFELD21';
    ready_at := greatest(now(), new.issue_date::timestamp at time zone 'Europe/Vienna');
  else
    select * into recipient from public.members where lower(email)='julia.potlog@gmail.com' and active and role='admin';
    subject_line := 'AUFELD21: Neue Meldung im Portal';
    message := E'Hallo Julia,\n\nim AUFELD21-Portal wurde eine neue Meldung eingereicht.\nBitte öffne im Adminbereich den Reiter „Meldungen“, um sie anzusehen und zu bearbeiten.\n\nhttps://www.aufeld21.at/portal\n\nDie Details bleiben geschützt im Portal.\n\nLiebe Grüße\nAUFELD21';
  end if;
  insert into public.email_notifications(kind,source_id,recipient_id,recipient_email,payload,available_at,status,last_error)
  values(case when TG_TABLE_NAME='invoices' then 'invoice' else 'issue' end,new.id,recipient.id,
    coalesce(recipient.email,'julia.potlog@gmail.com'),
    jsonb_build_object('from','AUFELD21 <noreply@aufeld21.at>','to',jsonb_build_array(coalesce(recipient.email,'julia.potlog@gmail.com')),
      'subject',subject_line,'text',message),ready_at,
    case when recipient.id is null then 'review' else 'pending' end,
    case when recipient.id is null then 'Empfängerin ist nicht als aktive Administratorin freigeschaltet.' end)
  on conflict(kind,source_id) do nothing;
  return new;
end $$;
revoke all on function notification_private.enqueue_email() from public,anon,authenticated,service_role;
create trigger invoice_email_after_finalization after insert or update of status on public.invoices
  for each row execute function notification_private.enqueue_email();
create trigger issue_email_after_insert after insert on public.issue_reports
  for each row execute function notification_private.enqueue_email();

-- The cron owner, not a browser client, processes this durable outbox. No network
-- call runs inside the invoice/report transaction. A missing provider never loses
-- an event. One submission per minute also leaves room for simultaneous Auth mail.
create function notification_private.process_emails() returns void
language plpgsql security invoker set search_path='' as $$
declare job public.email_notifications%rowtype; response record; parsed jsonb; api_key text; cfg public.email_notification_settings%rowtype;
  next_request bigint; today_start timestamptz; month_start timestamptz;
begin
  if not pg_try_advisory_xact_lock(21021,709) then return; end if;
  select * into cfg from public.email_notification_settings where id;
  update public.email_notification_settings set last_run_at=now() where id;

  -- Persist provider acknowledgements before selecting any work. "accepted" is
  -- deliberately not called "delivered": mailbox delivery is visible in Resend.
  for job in select * from public.email_notifications where status='processing' for update skip locked loop
    select * into response from net._http_response where id=job.request_id order by created desc limit 1;
    if not found and job.last_attempt_at > now()-interval '5 minutes' then continue; end if;
    parsed := '{}'::jsonb;
    begin parsed := coalesce(response.content::jsonb,'{}'::jsonb); exception when others then parsed := '{}'::jsonb; end;
    if response.status_code between 200 and 299 and nullif(parsed->>'id','') is not null then
      update public.email_notifications set status='accepted',provider_id=parsed->>'id',accepted_at=now(),last_error=null where id=job.id;
    elsif response.status_code between 400 and 499 and response.status_code not in (408,429) then
      update public.email_notifications set status=case when response.status_code=409 then 'review' else 'failed' end,
        last_error='Maildienst hat den Versand abgewiesen (HTTP '||response.status_code||').' where id=job.id;
    elsif response.status_code=429 then
      update public.email_notifications set status='pending',available_at=now()+interval '1 hour',
        last_error='Versandlimit erreicht. Automatischer neuer Versuch folgt.' where id=job.id;
    else
      update public.email_notifications set status='pending',available_at=now()+interval '5 minutes',uncertain_delivery=true,
        last_error='Versandantwort fehlt oder ist vorübergehend fehlerhaft. Erneute Prüfung folgt.' where id=job.id;
    end if;
  end loop;
  if not cfg.enabled then return; end if;
  select decrypted_secret into api_key from vault.decrypted_secrets where name='aufeld21_notification_resend_key' limit 1;
  if coalesce(api_key,'')='' then
    update public.email_notification_settings set last_error='Versand-Schlüssel fehlt. Nachrichten bleiben gespeichert.' where id;
    return;
  end if;
  update public.email_notification_settings set last_error=null where id;

  -- Resend retains idempotency keys for 24h. Never risk a duplicate by blindly
  -- resubmitting an old request with uncertain delivery after that window.
  update public.email_notifications set status='review',last_error='Versand nicht eindeutig bestätigt. Vor erneutem Versand in Resend prüfen (24-Stunden-Schutz).'
    where status='pending' and uncertain_delivery and first_attempt_at <= now()-interval '23 hours';

  -- Recheck current membership/ownership before sending, including retries.
  update public.email_notifications n set status='skipped',last_error='Empfängerzugang deaktiviert, Adresse geändert oder Quelle nicht mehr gültig.'
    where n.status='pending' and not exists(select 1 from public.members m
      where m.id=n.recipient_id and m.active and lower(m.email)=lower(n.recipient_email)
      and ((n.kind='issue' and m.role='admin' and lower(m.email)='julia.potlog@gmail.com'
        and exists(select 1 from public.issue_reports r where r.id=n.source_id))
      or (n.kind='invoice' and m.role<>'employee' and exists(select 1 from public.invoices i
        where i.id=n.source_id and i.member_id=m.id and i.status in ('final','paid')))));

  today_start := date_trunc('day',now() at time zone 'UTC') at time zone 'UTC';
  month_start := date_trunc('month',now() at time zone 'UTC') at time zone 'UTC';
  select * into job from public.email_notifications n where status='pending' and available_at<=now()
    and (first_attempt_at is not null or (
      (select count(*) from public.email_notifications where first_attempt_at>=today_start)<cfg.daily_limit
      and (select count(*) from public.email_notifications where first_attempt_at>=month_start)<cfg.monthly_limit))
    order by case when kind='issue' then 0 else 1 end,available_at,created_at for update skip locked limit 1;
  if not found then return; end if;
  begin
    next_request := net.http_post(url:='https://api.resend.com/emails',body:=job.payload,
      headers:=jsonb_build_object('Authorization','Bearer '||api_key,'Content-Type','application/json',
        'Idempotency-Key','aufeld21-notification/'||job.id::text),timeout_milliseconds:=10000);
    update public.email_notifications set status='processing',request_id=next_request,
      first_attempt_at=coalesce(first_attempt_at,now()),last_attempt_at=now(),attempts=attempts+1 where id=job.id;
  exception when others then
    -- The subtransaction rolls back both the request and state on any SQL failure.
    update public.email_notification_settings set last_error='Versand konnte nicht gestartet werden. Wartende Nachrichten bleiben gespeichert.' where id;
  end;
end $$;
revoke all on function notification_private.process_emails() from public,anon,authenticated,service_role;

select cron.schedule('aufeld21-email-notifications','* * * * *','select notification_private.process_emails()');
