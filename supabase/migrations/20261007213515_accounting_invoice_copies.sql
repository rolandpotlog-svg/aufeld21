-- Separate accounting copies: new finalizations only, never a historical backfill.
-- Deployment stays fail-closed until the two excluded customer IDs are configured.
alter table public.email_notification_settings
  add column accounting_enabled boolean not null default false,
  add column accounting_recipient text not null default 'rechnung@immo-kredit.net'
    check (accounting_recipient='rechnung@immo-kredit.net'),
  add column accounting_excluded_member_ids uuid[] not null default '{}';
alter table public.email_notifications drop constraint email_notifications_kind_check;
alter table public.email_notifications add constraint email_notifications_kind_check
  check (kind in ('invoice','issue','reminder','accounting_invoice'));
alter table public.email_notifications
  add column preparation_lease uuid,
  add column preparation_until timestamptz,
  add column preparation_attempts integer not null default 0;
create index email_accounting_preparation_idx on public.email_notifications(available_at,created_at)
  where kind='accounting_invoice' and status='pending' and not (payload ? 'attachments');

create function notification_private.accounting_eligible(invoice_id uuid, owner_id uuid, destination text)
returns boolean language sql stable security invoker set search_path='' as $$
  select exists(select 1 from public.email_notification_settings s
    join public.invoices i on i.id=invoice_id join public.members m on m.id=i.member_id
    where s.id and s.accounting_enabled and s.accounting_recipient=destination
      and cardinality(s.accounting_excluded_member_ids)=2
      and array_position(s.accounting_excluded_member_ids,null) is null
      and not (i.member_id=any(s.accounting_excluded_member_ids))
      and i.member_id=owner_id and m.role<>'employee'
      and i.status in ('final','paid') and i.invoice_number is not null);
$$;
revoke all on function notification_private.accounting_eligible(uuid,uuid,text) from public,anon,authenticated,service_role;

-- Private definer trigger only enqueues already-authorized invoice writes.
create function notification_private.enqueue_accounting_invoice() returns trigger
language plpgsql security definer set search_path='' as $$
declare destination text;
begin
  if new.status not in ('final','paid') or new.invoice_number is null then return new; end if;
  if TG_OP='UPDATE' and old.status<>'draft' then return new; end if;
  select accounting_recipient into destination from public.email_notification_settings where id;
  if not notification_private.accounting_eligible(new.id,new.member_id,destination) then return new; end if;
  insert into public.email_notifications(kind,source_id,recipient_id,recipient_email,payload,available_at)
    values('accounting_invoice',new.id,new.member_id,destination,'{}',
      greatest(now(),new.issue_date::timestamp at time zone 'Europe/Vienna'))
    on conflict(kind,source_id) do nothing;
  return new;
end $$;
revoke all on function notification_private.enqueue_accounting_invoice() from public,anon,authenticated,service_role;
create trigger invoice_accounting_after_finalization after insert or update of status on public.invoices
  for each row execute function notification_private.enqueue_accounting_invoice();

-- Server-only RPCs: no browser client gets secrets, leases or a send endpoint.
create function public.accounting_dispatch_secret() returns text
language sql security definer set search_path='' as $$
  select decrypted_secret from vault.decrypted_secrets where name='aufeld21_accounting_dispatch_secret' limit 1;
$$;
revoke all on function public.accounting_dispatch_secret() from public,anon,authenticated;
grant execute on function public.accounting_dispatch_secret() to service_role;

create function public.accounting_claim() returns table(job_id uuid,invoice_id uuid,lease uuid)
language plpgsql security definer set search_path='' as $$
begin
  if not exists(select 1 from public.email_notification_settings where id and enabled and accounting_enabled) then return; end if;
  update public.email_notifications n set status='review',last_error='Rechnungs-PDF konnte nach mehreren Versuchen nicht vorbereitet werden.'
    where n.kind='accounting_invoice' and n.status='pending' and not (n.payload ? 'attachments')
      and n.preparation_attempts>=5 and coalesce(n.preparation_until,'-infinity')<=now();
  return query
    with selected as (select n.id from public.email_notifications n
      where n.kind='accounting_invoice' and n.status='pending' and not (n.payload ? 'attachments')
        and n.available_at<=now() and coalesce(n.preparation_until,'-infinity')<=now()
        and notification_private.accounting_eligible(n.source_id,n.recipient_id,n.recipient_email)
      order by n.available_at,n.created_at for update skip locked limit 5)
    update public.email_notifications n set preparation_lease=gen_random_uuid(),
      preparation_until=now()+interval '3 minutes',preparation_attempts=preparation_attempts+1
      from selected s where n.id=s.id returning n.id,n.source_id,n.preparation_lease;
end $$;
revoke all on function public.accounting_claim() from public,anon,authenticated;
grant execute on function public.accounting_claim() to service_role;

create function public.accounting_prepare(target_job uuid,target_lease uuid,pdf_base64 text)
returns boolean language plpgsql security definer set search_path='' as $$
declare job public.email_notifications%rowtype; inv public.invoices%rowtype; recipient text; body text; raw_pdf bytea;
begin
  select * into job from public.email_notifications where id=target_job and kind='accounting_invoice'
    and status='pending' and preparation_lease=target_lease and preparation_until>now()
    and first_attempt_at is null and not (payload ? 'attachments') for update;
  if not found then return false; end if;
  perform 1 from public.email_notification_settings where id for share;
  select * into inv from public.invoices where id=job.source_id for share;
  if not notification_private.accounting_eligible(job.source_id,job.recipient_id,job.recipient_email) then
    update public.email_notifications set status='skipped',last_error='Buchhaltungskopie nicht mehr freigegeben.' where id=job.id;
    return false;
  end if;
  if pdf_base64 is null or length(pdf_base64)>4000000 or pdf_base64 !~ '^[A-Za-z0-9+/]+={0,2}$' then raise exception 'INVALID_PDF'; end if;
  raw_pdf:=decode(pdf_base64,'base64');
  if substring(raw_pdf from 1 for 5)<>decode('255044462d','hex') then raise exception 'INVALID_PDF'; end if;
  select recipient_name into recipient from public.invoice_snapshots where invoice_id=inv.id and pdf_version in (1,2);
  if recipient is null then raise exception 'MISSING_ORIGINAL'; end if;
  body:=E'Hallo,\n\nim Anhang ist die Ausgangsrechnung '||inv.invoice_number||' der Potlog Immobilien KG / AUFELD21 für die Buchhaltung.'
    ||E'\nRechnungsempfänger: '||recipient||E'\nLeistungszeitraum: '||to_char(inv.service_period_start,'DD.MM.YYYY')
    ||' bis '||to_char(inv.service_period_end,'DD.MM.YYYY')
    ||E'\n\nDies ist eine Buchhaltungskopie, keine Zahlungsaufforderung an die Buchhaltung.\n\nLiebe Grüße\nJulia & Roland\nAUFELD21';
  update public.email_notifications set payload=jsonb_build_object(
    'from','AUFELD21 <noreply@aufeld21.at>','to',jsonb_build_array(job.recipient_email),
    'subject','AUFELD21 · Buchhaltung · Rechnung '||inv.invoice_number,'text',body,
    'attachments',jsonb_build_array(jsonb_build_object('filename','Rechnung-'||regexp_replace(inv.invoice_number,'[^A-Za-z0-9-]','-','g')||'.pdf','content',pdf_base64))),
    preparation_lease=null,preparation_until=null,last_error=null where id=job.id;
  return true;
end $$;
revoke all on function public.accounting_prepare(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.accounting_prepare(uuid,uuid,text) to service_role;

create function notification_private.dispatch_accounting() returns void
language plpgsql security invoker set search_path='' as $$
declare secret text; stamp text;
begin
  if not pg_try_advisory_xact_lock(21021,712) then return; end if;
  if not exists(select 1 from public.email_notification_settings where id and enabled and accounting_enabled) then return; end if;
  if not exists(select 1 from public.email_notifications where kind='accounting_invoice' and status='pending'
    and not (payload ? 'attachments') and available_at<=now() and coalesce(preparation_until,'-infinity')<=now()) then return; end if;
  select decrypted_secret into secret from vault.decrypted_secrets where name='aufeld21_accounting_dispatch_secret' limit 1;
  if coalesce(secret,'')='' then return; end if;
  stamp:=floor(extract(epoch from now()))::bigint::text;
  perform net.http_post(url:='https://www.aufeld21.at/api/cron/accounting-invoices',body:=jsonb_build_object('timestamp',stamp),
    headers:=jsonb_build_object('Content-Type','application/json','X-Accounting-Signature',
      encode(extensions.hmac(stamp,secret,'sha256'),'hex')),timeout_milliseconds:=50000);
end $$;
revoke all on function notification_private.dispatch_accounting() from public,anon,authenticated,service_role;
select cron.schedule('aufeld21-accounting-preparation','* * * * *','select notification_private.dispatch_accounting()');

-- Keep the existing provider acknowledgement, limits and idempotency semantics.
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
    where n.status='pending' and n.kind<>'accounting_invoice' and not exists(select 1 from public.members m
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

  update public.email_notifications n set status='skipped',last_error='Buchhaltungskopie ausgeschlossen, storniert oder nicht mehr freigegeben.'
    where n.kind='accounting_invoice' and n.status='pending'
      and not notification_private.accounting_eligible(n.source_id,n.recipient_id,n.recipient_email);

  today_start := date_trunc('day',now() at time zone 'UTC') at time zone 'UTC';
  month_start := date_trunc('month',now() at time zone 'UTC') at time zone 'UTC';
  select * into job from public.email_notifications n where status='pending' and available_at<=now()
    and (kind<>'accounting_invoice' or payload ? 'attachments')
    and (first_attempt_at is not null or (
      (select count(*) from public.email_notifications where first_attempt_at>=today_start)<cfg.daily_limit
      and (select count(*) from public.email_notifications where first_attempt_at>=month_start)<cfg.monthly_limit))
    order by case when kind='issue' then 0 else 1 end,available_at,created_at for update skip locked limit 1;
  if not found then return; end if;
  if job.kind='accounting_invoice' then
    perform 1 from public.email_notification_settings where id for share;
    perform 1 from public.invoices where id=job.source_id for share;
    if not notification_private.accounting_eligible(job.source_id,job.recipient_id,job.recipient_email) then
      update public.email_notifications set status='skipped',last_error='Buchhaltungskopie vor Versand nicht mehr freigegeben.' where id=job.id;
      return;
    end if;
  end if;
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
