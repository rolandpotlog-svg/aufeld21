-- Website enquiries are private, even though submitting the form needs no login.
create table public.contact_requests (
  id uuid primary key,
  name text not null check (length(name) between 2 and 120),
  email text not null check (length(email) between 3 and 254 and email !~ '[[:cntrl:]]'),
  phone text not null default '' check (length(phone)<=50),
  offer text not null check (offer in ('Büro','Flex-Tisch','Fix-Tisch','Postservice','Business-Standort','Besichtigung / Sonstiges')),
  message text not null check (length(message) between 10 and 2000),
  status text not null default 'new' check(status in ('new','appointment','done')),
  notes text not null default '' check(length(notes)<=5000),
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.members(id) on delete set null
);
create index contact_requests_status_date_idx on public.contact_requests(status,created_at desc);
create index contact_requests_updated_by_idx on public.contact_requests(updated_by);
alter table public.contact_requests enable row level security;
revoke all on public.contact_requests from public,anon,authenticated;
grant select on public.contact_requests to authenticated;
grant all on public.contact_requests to service_role;
create policy "Active admins read enquiries" on public.contact_requests for select to authenticated
  using(exists(select 1 from public.members m where m.id=(select auth.uid()) and m.active and m.role='admin'));

-- Opaque, purpose-specific HMACs, not raw IP addresses or email addresses.
create table notification_private.contact_limits (
  bucket text not null, window_start timestamptz not null, hits integer not null,
  primary key(bucket,window_start)
);
grant usage on schema notification_private to service_role;
grant all on notification_private.contact_limits to service_role;
create function public.submit_contact_request(p_id uuid,p_name text,p_email text,p_phone text,p_offer text,p_message text,p_ip_hash text,p_email_hash text)
returns void language plpgsql security invoker set search_path='' as $$
declare b record; n integer;
begin
  if p_ip_hash !~ '^[a-f0-9]{64}$' or p_email_hash !~ '^[a-f0-9]{64}$' or p_ip_hash is null or p_email_hash is null then raise exception 'INVALID'; end if;
  perform pg_advisory_xact_lock(21021,910);
  -- Retries of an acknowledged/ambiguous submission do not create duplicates.
  if exists(select 1 from public.contact_requests where id=p_id) then return; end if;
  delete from notification_private.contact_limits where window_start<now()-interval '48 hours';
  for b in select * from (values
    ('ip-hour:'||p_ip_hash,date_trunc('hour',now()),5),
    ('ip-day:'||p_ip_hash,date_trunc('day',now() at time zone 'UTC') at time zone 'UTC',30),
    ('email:'||p_email_hash,date_trunc('day',now() at time zone 'UTC') at time zone 'UTC',3),
    ('global',date_trunc('day',now() at time zone 'UTC') at time zone 'UTC',100)
  ) as limits(bucket,window_start,maximum) loop
    insert into notification_private.contact_limits values(b.bucket,b.window_start,1)
      on conflict(bucket,window_start) do update set hits=contact_limits.hits+1 returning hits into n;
    if n>b.maximum then raise exception 'CONTACT_RATE_LIMIT'; end if;
  end loop;
  insert into public.contact_requests(id,name,email,phone,offer,message) values(p_id,p_name,p_email,p_phone,p_offer,p_message);
end $$;
revoke all on function public.submit_contact_request(uuid,text,text,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.submit_contact_request(uuid,text,text,text,text,text,text,text) to service_role;

create table public.invoice_reminders (
  id uuid primary key,
  invoice_id uuid not null references public.invoices(id) on delete restrict,
  requested_by uuid not null references public.members(id) on delete restrict,
  created_at timestamptz not null default now()
);
create index invoice_reminders_invoice_idx on public.invoice_reminders(invoice_id,created_at desc);
create index invoice_reminders_admin_idx on public.invoice_reminders(requested_by);
alter table public.invoice_reminders enable row level security;
revoke all on public.invoice_reminders from public,anon,authenticated;
grant select on public.invoice_reminders to authenticated;
grant all on public.invoice_reminders to service_role;
create policy "Active admins read reminders" on public.invoice_reminders for select to authenticated
  using(exists(select 1 from public.members m where m.id=(select auth.uid()) and m.active and m.role='admin'));
alter table public.email_notifications drop constraint email_notifications_kind_check;
alter table public.email_notifications add constraint email_notifications_kind_check check(kind in ('invoice','issue','reminder'));

-- Preview and send share this one template. No client-supplied recipients/text.
create function public.invoice_reminder_preview(p_invoice uuid,p_admin uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare i public.invoices%rowtype; m public.members%rowtype; body jsonb; today date:=(now() at time zone 'Europe/Vienna')::date;
begin
  if not exists(select 1 from public.members where id=p_admin and active and role='admin') then raise exception 'NOT_ADMIN'; end if;
  select * into i from public.invoices where id=p_invoice;
  if not found or i.status<>'final' or i.issue_date>today or i.due_date>=today or i.invoice_number is null then raise exception 'NOT_OVERDUE'; end if;
  if coalesce((select sum(quantity*unit_price_net*(1+vat_rate/100)) from public.invoice_items where invoice_id=i.id),0)<=0 then raise exception 'NOT_OVERDUE'; end if;
  select * into m from public.members where id=i.member_id and active and role<>'employee';
  if not found or coalesce(m.email,'')='' then raise exception 'NO_RECIPIENT'; end if;
  if not exists(select 1 from public.invoice_snapshots where invoice_id=i.id and pdf_version in(1,2)) then raise exception 'NO_ORIGINAL'; end if;
  if exists(select 1 from public.invoice_reminders r join public.email_notifications n on n.kind='reminder' and n.source_id=r.id
    where r.invoice_id=i.id and (n.status in('pending','processing','review') or (n.status='accepted' and n.accepted_at>now()-interval '7 days'))) then raise exception 'REMINDER_EXISTS'; end if;
  body:=jsonb_build_object('from','AUFELD21 <noreply@aufeld21.at>','to',jsonb_build_array(m.email),
    'subject','AUFELD21: Freundliche Zahlungserinnerung – '||i.invoice_number,
    'text',E'Hallo,\n\nunsere Rechnung '||i.invoice_number||' (zahlbar bis '||to_char(i.due_date,'DD.MM.YYYY')||E') ist im Portal noch als offen vermerkt.\nBitte prüfe kurz, ob die Überweisung bereits erfolgt ist. Falls du schon bezahlt hast, kannst du diese Erinnerung ignorieren – vielen Dank!\n\nDie Rechnung findest du hier:\nhttps://www.aufeld21.at/portal\n\nBei Fragen melde dich gerne bei uns.\n\nLiebe Grüße\nJulia & Roland\nAUFELD21');
  return jsonb_build_object('recipient',m.email,'subject',body->>'subject','text',body->>'text','fingerprint',md5(body::text),'payload',body);
end $$;
revoke all on function public.invoice_reminder_preview(uuid,uuid) from public,anon,authenticated;
grant execute on function public.invoice_reminder_preview(uuid,uuid) to service_role;

create function public.queue_invoice_reminder(p_invoice uuid,p_id uuid,p_admin uuid,p_fingerprint text) returns uuid
language plpgsql security invoker set search_path='' as $$
declare preview jsonb; recipient uuid;
begin
  if not exists(select 1 from public.members where id=p_admin and active and role='admin') then raise exception 'NOT_ADMIN'; end if;
  perform pg_advisory_xact_lock(21021,911);
  if exists(select 1 from public.invoice_reminders where id=p_id and invoice_id=p_invoice and requested_by=p_admin) then return p_id; end if;
  -- Serialize approval with status/recipient changes; never change the invoice.
  select member_id into recipient from public.invoices where id=p_invoice for share;
  perform 1 from public.members where id=recipient for share;
  preview:=public.invoice_reminder_preview(p_invoice,p_admin);
  if p_fingerprint is distinct from preview->>'fingerprint' then raise exception 'STALE_PREVIEW'; end if;
  insert into public.invoice_reminders(id,invoice_id,requested_by) values(p_id,p_invoice,p_admin);
  insert into public.email_notifications(kind,source_id,recipient_id,recipient_email,payload)
    values('reminder',p_id,recipient,preview->>'recipient',preview->'payload');
  return p_id;
end $$;
revoke all on function public.queue_invoice_reminder(uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.queue_invoice_reminder(uuid,uuid,uuid,text) to service_role;
create or replace function notification_private.process_emails() returns void
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
        where i.id=n.source_id and i.member_id=m.id and i.status in ('final','paid')))
      or (n.kind='reminder' and m.role<>'employee' and exists(select 1 from public.invoice_reminders r
        join public.invoices i on i.id=r.invoice_id join public.members a on a.id=r.requested_by
        where r.id=n.source_id and i.member_id=m.id and i.status='final'
          and i.issue_date<=(now() at time zone 'Europe/Vienna')::date
          and i.due_date<(now() at time zone 'Europe/Vienna')::date and a.active and a.role='admin'))));

  today_start := date_trunc('day',now() at time zone 'UTC') at time zone 'UTC';
  month_start := date_trunc('month',now() at time zone 'UTC') at time zone 'UTC';
  select * into job from public.email_notifications n where status='pending' and available_at<=now()
    and (first_attempt_at is not null or (
      (select count(*) from public.email_notifications where first_attempt_at>=today_start)<cfg.daily_limit
      and (select count(*) from public.email_notifications where first_attempt_at>=month_start)<cfg.monthly_limit))
    order by case when kind='issue' then 0 else 1 end,available_at,created_at for update skip locked limit 1;
  if not found then return; end if;
  if job.kind='reminder' then
    -- Lock the invoice through dispatch, so recording payment cannot race this check.
    perform 1 from public.invoices i join public.invoice_reminders r on r.invoice_id=i.id
      join public.members m on m.id=i.member_id join public.members a on a.id=r.requested_by
      where r.id=job.source_id and i.status='final' and i.due_date<(now() at time zone 'Europe/Vienna')::date
        and m.active and m.role<>'employee' and lower(m.email)=lower(job.recipient_email)
        and a.active and a.role='admin' for share of i,m,a;
    if not found then
      update public.email_notifications set status='skipped',last_error='Rechnung oder Empfänger vor Versand nicht mehr gültig.' where id=job.id;
      return;
    end if;
  end if;
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
