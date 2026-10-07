import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { PDFDocument } from 'pdf-lib';
import { accountingPdf } from './accounting.ts';
import type { ExportInvoice } from '../invoices/export.ts';

const admin='00000000-0000-4000-8000-000000000001', tenant='00000000-0000-4000-8000-000000000002';
const slaven='00000000-0000-4000-8000-000000000003', daniel='00000000-0000-4000-8000-000000000004', employee='00000000-0000-4000-8000-000000000005';
const migration = await readFile(new URL('../../supabase/migrations/20261007213515_accounting_invoice_copies.sql',import.meta.url),'utf8');
const pdf=Buffer.from('%PDF-1.7\nTEST ONLY').toString('base64');
async function setup() {
  const db=new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; grant usage on schema auth to authenticated;
    create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
    create table members(id uuid primary key,email text,name text,role text,active boolean);
    grant select on members to authenticated;
    insert into members values
      ('${admin}','julia.potlog@gmail.com','Julia','admin',true),
      ('${tenant}','tenant@example.test','Tenant','member',true),
      ('${slaven}','slaven@example.test','Slaven','partner',true),
      ('${daniel}','daniel@example.test','Daniel','partner',true),
      ('${employee}','employee@example.test','Employee','employee',true);
    create table invoices(id uuid primary key default gen_random_uuid(),member_id uuid,status text,invoice_number text,
      issue_date date default current_date,service_period_start date default current_date,service_period_end date default current_date,due_date date default current_date);
    create table invoice_snapshots(invoice_id uuid primary key,pdf_version integer,recipient_name text);
    create table invoice_items(invoice_id uuid,quantity numeric,unit_price_net numeric,vat_rate numeric);
    create table issue_reports(id uuid primary key default gen_random_uuid(),member_id uuid,note text);
    create schema net; create schema cron; create schema vault; create schema extensions;
    create table net.requests(id bigserial primary key,url text,body jsonb,headers jsonb);
    create table net._http_response(id bigint,status_code int,content text,created timestamptz default now());
    create function net.http_post(url text,body jsonb,headers jsonb,timeout_milliseconds int) returns bigint language sql as $$insert into net.requests(url,body,headers) values(url,body,headers) returning id$$;
    create function cron.schedule(text,text,text) returns bigint language sql as $$select 1::bigint$$;
    create function extensions.hmac(text,text,text) returns bytea language sql as $$select decode(repeat('ab',32),'hex')$$;
    create table vault.decrypted_secrets(name text,decrypted_secret text);
    insert into vault.decrypted_secrets values('aufeld21_notification_resend_key','fake-test-key'),('aufeld21_accounting_dispatch_secret','fake-dispatch-secret');
    insert into invoices(member_id,status,invoice_number) values('${tenant}','final','OLD-1');
  `);
  for(const file of ['20260907190833_email_notifications.sql','20260907211810_contact_requests_and_manual_reminders.sql']) {
    await db.exec((await readFile(new URL('../../supabase/migrations/'+file,import.meta.url),'utf8')).replace(/^create extension .*;$/gm,''));
  }
  await db.exec(migration);
  return db;
}
async function enable(db:PGlite) { await db.exec(`update email_notification_settings set enabled=true,accounting_enabled=true,accounting_excluded_member_ids=array['${slaven}'::uuid,'${daniel}'::uuid]`); }
async function invoice(db:PGlite,owner=tenant,status='final',days=0) {
  const id=(await db.query<{id:string}>("insert into invoices(member_id,status,invoice_number,issue_date) values($1,$2,'NEW-1',current_date+$3::int) returning id",[owner,status,days])).rows[0].id;
  await db.query('insert into invoice_snapshots values($1,2,\'Frozen Recipient\')',[id]);
  return id;
}
async function jobs(db:PGlite) { return (await db.query<{id:string,status:string,source_id:string,request_id:number,payload:{to:string[],text:string,attachments:{filename:string,content:string}[]}}>("select * from email_notifications where kind='accounting_invoice' order by created_at,id")).rows; }
async function claim(db:PGlite) { return (await db.query<{job_id:string,invoice_id:string,lease:string}>('select * from accounting_claim()')).rows; }
async function prepare(db:PGlite,job:{job_id:string,lease:string},content=pdf) { return (await db.query<{ok:boolean}>('select accounting_prepare($1,$2,$3) ok',[job.job_id,job.lease,content])).rows[0].ok; }
async function worker(db:PGlite) { await db.exec('select notification_private.process_emails()'); }
async function requests(db:PGlite) { return (await db.query<{body:unknown,headers:unknown}>('select body,headers from net.requests order by id')).rows; }
async function isolateAccounting(db:PGlite) { await db.exec("delete from email_notifications where kind<>'accounting_invoice'"); }

test('accounting: future events only, stable customer exclusions, no duplicates and transactional enqueue',async()=>{
  const db=await setup();
  try {
    assert.equal((await jobs(db)).length,0,'no historical backfill');
    await invoice(db); assert.equal((await jobs(db)).length,0,'disabled until configured');
    await enable(db);
    await invoice(db,slaven); await invoice(db,daniel); await invoice(db,employee);
    assert.equal((await jobs(db)).length,0);
    await db.exec(`update members set name='New Name',email='new@example.test' where id='${slaven}'`);
    await invoice(db,slaven); assert.equal((await jobs(db)).length,0,'IDs survive name/email changes');
    const id=await invoice(db,tenant,'draft'); assert.equal((await jobs(db)).length,0);
    await db.query("update invoices set status='final' where id=$1",[id]);
    await db.query("update invoices set status='paid' where id=$1",[id]);
    await db.query("update invoices set status='final' where id=$1",[id]);
    assert.equal((await jobs(db)).length,1);
    await db.exec('begin'); await invoice(db); await db.exec('rollback');
    assert.equal((await jobs(db)).length,1);
    await invoice(db,tenant,'paid',5); await isolateAccounting(db);
    assert.equal((await claim(db)).length,1,'future invoices wait for issue date');
    await worker(db); assert.equal((await requests(db)).length,0,'never send before PDF preparation');
  } finally { await db.close(); }
});

test('accounting: leased preparation, frozen PDF, retries, quotas and provider acknowledgement',async()=>{
  const db=await setup();
  try {
    await enable(db); await invoice(db); await isolateAccounting(db);
    const [first]=await claim(db); assert.ok(first); assert.equal((await claim(db)).length,0);
    await db.exec("update email_notifications set preparation_until=now()-interval '1 minute'");
    const [second]=await claim(db); assert.notEqual(first.lease,second.lease);
    assert.equal(await prepare(db,first),false,'stale lease cannot acknowledge');
    await assert.rejects(prepare(db,second,Buffer.from('not a PDF').toString('base64')),/INVALID_PDF/);
    assert.equal(await prepare(db,second),true); assert.equal(await prepare(db,second),false);
    const payload=(await jobs(db))[0].payload;
    assert.deepEqual(payload.to,['rechnung@immo-kredit.net']);
    assert.equal(payload.attachments[0].content,pdf); assert.match(payload.attachments[0].filename,/\.pdf$/);
    assert.match(payload.text,/Frozen Recipient/); assert.match(payload.text,/keine Zahlungsaufforderung/);
    await worker(db); await worker(db); assert.equal((await requests(db)).length,1);
    await db.exec("insert into net._http_response select request_id,503,'{}',now() from email_notifications; select notification_private.process_emails()");
    await db.exec('update email_notifications set available_at=now()'); await worker(db);
    const sent=await requests(db); assert.deepEqual(sent[0],sent[1],'exactly same PDF and idempotency key on retry');
    await db.exec("insert into net._http_response select request_id,200,'{\"id\":\"accepted-test\"}',now() from email_notifications; select notification_private.process_emails()");
    assert.equal((await jobs(db))[0].status,'accepted');
    await db.exec('update email_notification_settings set daily_limit=1');
    await invoice(db); await isolateAccounting(db); const [next]=await claim(db); await prepare(db,next); await worker(db);
    assert.equal((await requests(db)).length,2,'shared provider quota applies to bookkeeping too');
  } finally { await db.close(); }
});

test('accounting: recheck exclusion and cancellation, bounded preparation failures, private RPCs',async()=>{
  const db=await setup();
  try {
    await enable(db); const id=await invoice(db); await isolateAccounting(db); const [job]=await claim(db);
    await db.query("update invoices set status='cancelled' where id=$1",[id]);
    assert.equal(await prepare(db,job),false); await worker(db); assert.equal((await requests(db)).length,0);
    const nextId=await invoice(db); await isolateAccounting(db); const [next]=await claim(db); await prepare(db,next);
    await db.exec(`update email_notification_settings set accounting_excluded_member_ids=array['${tenant}'::uuid,'${slaven}'::uuid]`);
    await worker(db); assert.equal((await jobs(db)).find(j=>j.source_id===nextId)?.status,'skipped');
    assert.equal((await requests(db)).length,0);
    await enable(db); await invoice(db); await isolateAccounting(db);
    await db.exec("update email_notifications set preparation_attempts=5 where status='pending'");
    assert.equal((await claim(db)).length,0); assert.ok((await jobs(db)).some(j=>j.status==='review'));
    for(const role of ['anon','authenticated']) {
      await db.exec('set role '+role);
      await assert.rejects(db.query('select accounting_dispatch_secret()'),/permission denied/);
      await assert.rejects(claim(db),/permission denied/);
      await assert.rejects(prepare(db,job),/permission denied/);
      await assert.rejects(db.exec('select notification_private.dispatch_accounting()'),/permission denied/);
      await db.exec('reset role');
    }
    await db.exec(`set role authenticated; set test.uid='${tenant}'`);
    assert.equal((await jobs(db)).length,0,'tenant cannot read accounting attachments');
    await db.exec('reset role; set role service_role');
    assert.equal((await db.query<{secret:string}>('select accounting_dispatch_secret() secret')).rows[0].secret,'fake-dispatch-secret');
  } finally { await db.close(); }
});

test('accounting PDF uses frozen originals, rejects drafts/cancellations and is readable',async()=>{
  const sample:ExportInvoice={id:tenant,invoice_number:'A21-TEST-1',status:'final',issue_date:'2026-10-01',due_date:'2026-10-10',service_period_start:'2026-10-01',service_period_end:'2026-10-31',paid_at:null,invoice_items:[{description:'Büro',quantity:1,unit:'Monat',unit_price_net:400,vat_rate:20,sort_order:0}],invoice_snapshots:{recipient_name:'Frozen Recipient',recipient_address:'Teststrasse 1',recipient_uid:null,pdf_version:2}};
  for(const version of [1,2]) {
    const content=await accountingPdf({...sample,invoice_snapshots:{...sample.invoice_snapshots as object,pdf_version:version} as ExportInvoice['invoice_snapshots']});
    const doc=await PDFDocument.load(Buffer.from(content,'base64'));
    assert.equal(doc.getPageCount(),1); assert.equal(doc.getTitle(),'Rechnung A21-TEST-1');
  }
  await assert.rejects(accountingPdf({...sample,status:'draft'}));
  await assert.rejects(accountingPdf({...sample,status:'cancelled'}));
  await assert.rejects(accountingPdf({...sample,invoice_snapshots:null}));
});

test('accounting: cancellation after preparation, uncertain delivery timeout, signed wakeup and unchanged member mail',async()=>{
  const db=await setup();
  try {
    await enable(db);
    const cancelled=await invoice(db); await isolateAccounting(db);
    const [job]=await claim(db); await prepare(db,job);
    await db.query("update invoices set status='cancelled' where id=$1",[cancelled]);
    await worker(db); assert.equal((await requests(db)).length,0);
    await invoice(db); await isolateAccounting(db);
    await db.exec('select notification_private.dispatch_accounting()');
    const wake=(await db.query<{url:string,body:{timestamp:string},headers:Record<string,string>}>('select * from net.requests')).rows[0];
    assert.equal(wake.url,'https://www.aufeld21.at/api/cron/accounting-invoices');
    assert.match(wake.body.timestamp,/^\d{10}$/); assert.match(wake.headers['X-Accounting-Signature'],/^[a-f0-9]{64}$/);
    await db.exec('delete from net.requests');
    const [next]=await claim(db); await prepare(db,next); await worker(db);
    await db.exec("update email_notifications set first_attempt_at=now()-interval '2 days',last_attempt_at=now()-interval '6 minutes' where status='processing'");
    await worker(db); assert.equal((await jobs(db)).find(j=>j.id===next.job_id)?.status,'review');
    assert.equal((await requests(db)).length,1,'no uncertain resend beyond provider idempotency window');
    await db.exec('delete from net.requests');
    await invoice(db,slaven); await worker(db);
    const ordinary=(await db.query<{body:{to:string[],attachments?:unknown}}>('select body from net.requests')).rows[0].body;
    assert.deepEqual(ordinary.to,['slaven@example.test']); assert.equal(ordinary.attachments,undefined);
    await db.exec(`insert into issue_reports(member_id,note) values('${tenant}','PRIVATE NOTE')`);
    await worker(db);
    assert.ok(JSON.stringify(await requests(db)).includes('julia.potlog@gmail.com'));
    assert.ok(!JSON.stringify(await requests(db)).includes('PRIVATE NOTE'));
  } finally { await db.close(); }
});
