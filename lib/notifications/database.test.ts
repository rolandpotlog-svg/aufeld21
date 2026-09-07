import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const julia = "00000000-0000-4000-8000-000000000001";
const tenant = "00000000-0000-4000-8000-000000000002";
const employee = "00000000-0000-4000-8000-000000000003";
const sql = await readFile(new URL("../../supabase/migrations/20260907190833_email_notifications.sql", import.meta.url), "utf8");

async function setup() {
  const db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; grant usage on schema auth to authenticated;
    create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
    create table public.members(id uuid primary key,email text,active boolean,role text);
    grant select on members to authenticated;
    insert into members values
      ('${julia}','julia.potlog@gmail.com',true,'admin'),
      ('${tenant}','tenant@example.test',true,'member'),
      ('${employee}','employee@example.test',true,'employee');
    create table public.invoices(id uuid primary key default gen_random_uuid(),member_id uuid,status text,invoice_number text,
      issue_date date default current_date,service_period_start date default current_date,service_period_end date default current_date,due_date date default current_date);
    create table public.issue_reports(id uuid primary key default gen_random_uuid(),member_id uuid,note text,status text default 'open');
    create schema net; create schema cron; create schema vault;
    create table net.requests(id bigserial primary key,url text,body jsonb,headers jsonb);
    create table net._http_response(id bigint,status_code int,content text,created timestamptz default now());
    create function net.http_post(url text,body jsonb,headers jsonb,timeout_milliseconds int) returns bigint language sql as $$
      insert into net.requests(url,body,headers) values(url,body,headers) returning id $$;
    create function cron.schedule(text,text,text) returns bigint language sql as $$select 1::bigint$$;
    create table vault.decrypted_secrets(name text,decrypted_secret text);
    insert into vault.decrypted_secrets values('aufeld21_notification_resend_key','test-key-not-real');
    insert into invoices(member_id,status,invoice_number) values('${tenant}','final','OLD-1');
  `);
  await db.exec(sql.replace(/^create extension .*;$/gm, ""));
  return db;
}
async function count(db: PGlite, table = "email_notifications") {
  return (await db.query<{n:number}>(`select count(*)::int n from ${table}`)).rows[0].n;
}
async function invoice(db: PGlite, member=tenant, status="final") {
  return (await db.query<{id:string}>("insert into invoices(member_id,status,invoice_number) values($1,$2,'NEW-1') returning id",[member,status])).rows[0].id;
}
async function issue(db: PGlite) {
  return (await db.query<{id:string}>("insert into issue_reports(member_id,note) values($1,'PRIVATE ISSUE TEXT') returning id",[tenant])).rows[0].id;
}
async function run(db: PGlite) { await db.exec("select notification_private.process_emails()"); }
async function state(db: PGlite) {
  return (await db.query<{status:string,request_id:number,last_error:string,payload:{to:string[],text:string},provider_id:string,attempts:number}>("select * from email_notifications order by created_at,id")).rows;
}
async function reply(db: PGlite,status:number,content=JSON.stringify({id:"resend-test-id"})) {
  await db.query("insert into net._http_response(id,status_code,content) select request_id,$1,$2 from email_notifications where status='processing'",[status,content]);
}

test("mail outbox: new events only, transaction safety, permissions and minimal contents",async()=>{
  const db=await setup();
  try {
    assert.equal(await count(db),0,"existing invoice must not cause mail");
    await invoice(db,employee);
    assert.equal(await count(db),0,"employees never receive invoices");
    const id=await invoice(db,tenant,"draft");
    assert.equal(await count(db),0);
    await db.query("update invoices set status='final' where id=$1",[id]);
    await db.query("update invoices set status='paid' where id=$1;",[id]);
    await db.query("update invoices set status='final' where id=$1;",[id]);
    assert.equal(await count(db),1,"paid/open toggles must not resend");
    await db.exec("begin"); await issue(db); await db.exec("rollback");
    assert.equal(await count(db),1,"rolled-back source creates no mail");
    await issue(db);
    const rows=await state(db);
    const issueMail=rows.find(x=>x.payload.to.includes("julia.potlog@gmail.com"))!;
    assert.ok(issueMail);
    assert.doesNotMatch(issueMail.payload.text,/PRIVATE ISSUE TEXT/);
    assert.match(issueMail.payload.text,/https:\/\/www.aufeld21.at\/portal/);
    for(const role of ["anon","authenticated","service_role"]) {
      const permissions=(await db.query<{allowed:boolean}>("select has_function_privilege($1,'notification_private.process_emails()','EXECUTE') allowed",[role])).rows[0];
      assert.equal(permissions.allowed,false);
    }
    await db.exec(`set role authenticated; set test.uid='${tenant}'`);
    assert.equal(await count(db),0,"tenant cannot read other recipients/logs");
    await assert.rejects(db.exec("insert into email_notifications(kind,source_id,recipient_email,payload) values('issue',gen_random_uuid(),'attacker@example.test','{}')"),/permission denied/);
    await db.exec(`set test.uid='${julia}'`);
    assert.equal(await count(db),2);
    await db.exec("reset role");
    await db.exec(`update members set active=false where id='${julia}'; set role authenticated`);
    assert.equal(await count(db),0,"inactive admin cannot read logs");
  } finally { await db.close(); }
});

test("mail worker: disabled/config safeguards, claim, acknowledgement, stable retry and no duplicates",async()=>{
  const db=await setup();
  try {
    await invoice(db); await run(db); assert.equal(await count(db,"net.requests"),0);
    await db.exec("update email_notification_settings set enabled=true; delete from vault.decrypted_secrets");
    await run(db); assert.equal(await count(db,"net.requests"),0);
    await db.exec("insert into vault.decrypted_secrets values('aufeld21_notification_resend_key','test-key-not-real')");
    await run(db); await run(db);
    assert.equal(await count(db,"net.requests"),1,"processing cannot be claimed twice");
    await reply(db,503,"not-json"); await run(db);
    assert.equal((await state(db))[0].status,"pending");
    await db.exec("update email_notifications set available_at=now()-interval '1 minute'");
    await run(db);
    const requests=(await db.query<{headers:unknown,body:unknown}>("select headers,body from net.requests order by id")).rows;
    assert.deepEqual(requests[0],requests[1],"retries must preserve payload and idempotency key");
    await reply(db,200); await run(db); await run(db);
    assert.equal((await state(db))[0].status,"accepted");
    assert.equal((await state(db))[0].provider_id,"resend-test-id");
    assert.equal(await count(db,"net.requests"),2);
  } finally { await db.close(); }
});

test("mail worker: retry limits, uncertain delivery, revoked access, cancellations and future dates",async()=>{
  const db=await setup();
  try {
    await db.exec("update email_notification_settings set enabled=true");
    const id=await invoice(db); await run(db); await reply(db,429,"{}"); await run(db);
    assert.equal((await state(db))[0].status,"pending");
    await db.exec("update email_notifications set first_attempt_at=now()-interval '2 days',available_at=now()-interval '1 minute'");
    await run(db); assert.equal((await state(db))[0].status,"processing","known rejection may retry after 24h");
    await reply(db,503,"{}"); await run(db);
    assert.equal((await state(db))[0].status,"review","uncertain requests older than idempotency window stop");
    await db.exec("delete from email_notifications; delete from net._http_response;");
    await issue(db); await db.exec(`update members set active=false where id='${julia}'`); await run(db);
    assert.equal((await state(db))[0].status,"skipped");
    await db.exec("delete from email_notifications");
    const cancelled=await invoice(db); await db.query("update invoices set status='cancelled' where id=$1",[cancelled]); await run(db);
    assert.equal((await state(db))[0].status,"skipped");
    await db.exec("delete from email_notifications");
    const future=await invoice(db,tenant,"draft");
    await db.query("update invoices set issue_date=current_date+5,status='final' where id=$1",[future]);
    const before=await count(db,"net.requests"); await run(db);
    assert.equal(await count(db,"net.requests"),before,"future invoices wait for issue date");
    assert.equal((await db.query<{n:number}>("select count(*)::int n from invoices where id=$1",[id])).rows[0].n,1,"worker never changes/deletes invoices");
  } finally { await db.close(); }
});

test("mail worker: daily quota, missing response after crash and permanent rejection",async()=>{
  const db=await setup();
  try {
    await db.exec("update email_notification_settings set enabled=true,daily_limit=1");
    await invoice(db); await run(db); await reply(db,200); await run(db);
    await issue(db); await run(db);
    assert.equal(await count(db,"net.requests"),1,"reserve quota for Auth mail");
    await db.exec("update email_notification_settings set daily_limit=70"); await run(db);
    await db.exec("update email_notifications set last_attempt_at=now()-interval '6 minutes' where status='processing'"); await run(db);
    const rows=await state(db); assert.ok(rows.find(r=>r.status==='pending'));
    await db.exec("update email_notifications set available_at=now() where status='pending'"); await run(db);
    await reply(db,403,"{}"); await run(db);
    assert.ok((await state(db)).find(r=>r.status==='failed'));
  } finally { await db.close(); }
});
