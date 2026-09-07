import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const admin = '00000000-0000-4000-8000-000000000001', tenant = '00000000-0000-4000-8000-000000000002', invoice = '00000000-0000-4000-8000-000000000003';
const original = await readFile(new URL('../../supabase/migrations/20260907190833_email_notifications.sql', import.meta.url), 'utf8');
const migration = await readFile(new URL('../../supabase/migrations/20260907211810_contact_requests_and_manual_reminders.sql', import.meta.url), 'utf8');
async function setup() {
  const db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; grant usage on schema auth to authenticated;
    create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
    create table members(id uuid primary key,email text,active boolean,role text);
    grant select on members to authenticated;
    insert into members values('${admin}','julia.potlog@gmail.com',true,'admin'),('${tenant}','tenant@example.test',true,'member');
    create table invoices(id uuid primary key,member_id uuid,status text,invoice_number text,issue_date date,service_period_start date,service_period_end date,due_date date);
    insert into invoices values('${invoice}','${tenant}','final','A21-TEST-1',current_date-5,current_date-5,current_date+20,current_date-1);
    create table invoice_snapshots(invoice_id uuid primary key,pdf_version integer);
    insert into invoice_snapshots values('${invoice}',2);
    create table invoice_items(invoice_id uuid,quantity numeric,unit_price_net numeric,vat_rate numeric);
    insert into invoice_items values('${invoice}',1,400,20);
    create table issue_reports(id uuid primary key default gen_random_uuid(),member_id uuid,note text);
    create schema net; create schema cron; create schema vault;
    create table net.requests(id bigserial primary key,url text,body jsonb,headers jsonb);
    create table net._http_response(id bigint,status_code int,content text,created timestamptz default now());
    create function net.http_post(url text,body jsonb,headers jsonb,timeout_milliseconds int) returns bigint language sql as $$insert into net.requests(url,body,headers) values(url,body,headers) returning id$$;
    create function cron.schedule(text,text,text) returns bigint language sql as $$select 1::bigint$$;
    create table vault.decrypted_secrets(name text,decrypted_secret text);
    insert into vault.decrypted_secrets values('aufeld21_notification_resend_key','fake-test-key');
  `);
  await db.exec(original.replace(/^create extension .*;$/gm, ''));
  await db.exec(migration);
  await db.exec('grant select on members,invoices,invoice_snapshots,invoice_items to service_role');
  return db;
}
async function count(db: PGlite, table: string) { return (await db.query<{ n: number }>(`select count(*)::int n from ${table}`)).rows[0].n; }
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
async function submit(db: PGlite, n: number, ip = 'a', email = 'b') {
  return db.query('select submit_contact_request($1,$2,$3,$4,$5,$6,$7,$8)', [id(n), 'Test Person', 'test@example.test', '', 'Büro', 'Bitte um eine Besichtigung.', ip.repeat(64), email.repeat(64)]);
}
async function preview(db: PGlite, user = admin) { return (await db.query<{ p: { fingerprint: string; recipient: string; text: string } }>('select invoice_reminder_preview($1,$2) p', [invoice, user])).rows[0].p; }
async function queue(db: PGlite, n: number, fingerprint: string) { return db.query('select queue_invoice_reminder($1,$2,$3,$4)', [invoice, id(n), admin, fingerprint]); }
async function state(db: PGlite) { return (await db.query<{ status: string; payload: { to: string[]; text: string }; request_id: number }>("select * from email_notifications where kind='reminder'")).rows[0]; }

test('enquiries: private access, rate limit rollback, idempotency and optimistic edits', async () => {
  const db = await setup();
  try {
    await db.exec('set role service_role');
    await submit(db, 10); await submit(db, 10);
    assert.equal(await count(db, 'contact_requests'), 1);
    await submit(db, 11); await submit(db, 12);
    await assert.rejects(submit(db, 13), /CONTACT_RATE_LIMIT/);
    assert.equal(await count(db, 'contact_requests'), 3);
    assert.equal((await db.query<{ hits: number }>("select hits from notification_private.contact_limits where bucket='global'")).rows[0].hits, 3);
    await db.exec('reset role; set role anon');
    await assert.rejects(db.query('select * from contact_requests'), /permission denied/);
    await assert.rejects(submit(db, 20), /permission denied/);
    await db.exec(`reset role; set role authenticated; select set_config('test.uid','${tenant}',false)`);
    assert.equal(await count(db, 'contact_requests'), 0);
    await assert.rejects(submit(db, 20), /permission denied/);
    await db.exec(`select set_config('test.uid','${admin}',false)`);
    assert.equal(await count(db, 'contact_requests'), 3);
    await assert.rejects(db.exec("update contact_requests set notes='hack'"), /permission denied/);
    await db.exec('reset role; set role service_role');
    assert.equal((await db.query("update contact_requests set version=2,notes='One' where id=$1 and version=1 returning id", [id(10)])).rows.length, 1);
    assert.equal((await db.query("update contact_requests set version=2,notes='Two' where id=$1 and version=1 returning id", [id(10)])).rows.length, 0);
  } finally { await db.close(); }
});

test('reminders: explicit approval, safe preview, idempotent queue, paid-before-send skips', async () => {
  const db = await setup();
  try {
    const before = JSON.stringify((await db.query('select * from invoices')).rows);
    assert.equal(await count(db, 'email_notifications'), 0);
    await assert.rejects(preview(db, tenant), /NOT_ADMIN/);
    await db.exec('set role authenticated');
    await assert.rejects(preview(db), /permission denied/);
    await db.exec('reset role');
    const p = await preview(db);
    assert.equal(p.recipient, 'tenant@example.test');
    assert.match(p.text, /bereits erfolgt/);
    assert.equal(await count(db, 'email_notifications'), 0, 'preview must not enqueue');
    await assert.rejects(queue(db, 40, 'outdated'), /STALE_PREVIEW/);
    await queue(db, 40, p.fingerprint); await queue(db, 40, p.fingerprint);
    assert.equal(await count(db, 'invoice_reminders'), 1);
    assert.equal(await count(db, 'email_notifications'), 1);
    assert.equal((await state(db)).payload.text, p.text);
    await assert.rejects(queue(db, 41, p.fingerprint), /REMINDER_EXISTS/);
    assert.equal(JSON.stringify((await db.query('select * from invoices')).rows), before);
    await db.exec("update invoices set status='paid'; update email_notification_settings set enabled=true; select notification_private.process_emails()");
    assert.equal((await state(db)).status, 'skipped');
    assert.equal(await count(db, 'net.requests'), 0);
    await assert.rejects(preview(db), /NOT_OVERDUE/);
  } finally { await db.close(); }
});

test('reminders: sender worker acknowledgement, cooldown, retries and changed recipient', async () => {
  const db = await setup();
  try {
    let p = await preview(db);
    await db.query("update members set email='changed@example.test' where id=$1", [tenant]);
    await assert.rejects(queue(db, 50, p.fingerprint), /STALE_PREVIEW/);
    p = await preview(db); await queue(db, 50, p.fingerprint);
    await db.exec('update email_notification_settings set enabled=true; select notification_private.process_emails()');
    assert.equal((await state(db)).status, 'processing');
    assert.equal(await count(db, 'net.requests'), 1);
    await db.exec(`insert into net._http_response select request_id,200,'{"id":"fake-provider-id"}',now() from email_notifications; select notification_private.process_emails()`);
    assert.equal((await state(db)).status, 'accepted');
    await assert.rejects(preview(db), /REMINDER_EXISTS/);
    await db.exec("update email_notifications set accepted_at=now()-interval '8 days'");
    p = await preview(db); await queue(db, 51, p.fingerprint);
    await db.query("update members set active=false where id=$1", [tenant]);
    await db.exec('select notification_private.process_emails()');
    assert.equal(await count(db, 'net.requests'), 1);
    assert.equal((await db.query<{ status: string }>("select status from email_notifications where source_id=$1", [id(51)])).rows[0].status, 'skipped');
  } finally { await db.close(); }
});

test('updated mail worker still handles invoice and issue events without backfill', async () => {
  const db = await setup();
  try {
    assert.equal(await count(db, 'email_notifications'), 0);
    await db.query("insert into issue_reports(member_id,note) values($1,'private text')", [tenant]);
    await db.exec('update email_notification_settings set enabled=true; select notification_private.process_emails()');
    const request = (await db.query<{ body: { to: string[]; text: string } }>('select body from net.requests')).rows[0];
    assert.deepEqual(request.body.to, ['julia.potlog@gmail.com']);
    assert.ok(!request.body.text.includes('private text'));
    await db.exec("update invoices set status='draft'; update invoices set status='final'; select notification_private.process_emails()");
    assert.equal(await count(db, 'net.requests'), 2);
  } finally { await db.close(); }
});
