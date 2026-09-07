import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { packages } from './packages.ts';
import { meetingSummary, type ManagedMember } from './directory.ts';

const admin='00000000-0000-4000-8000-000000000001';
const tenant='00000000-0000-4000-8000-000000000002';
const staff='00000000-0000-4000-8000-000000000003';
const second='00000000-0000-4000-8000-000000000004';
async function setup(withExistingInvoice=false) {
  const db=new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql as $$select null::uuid$$;
    create function auth.jwt() returns jsonb language sql as $$select '{"role":"service_role"}'::jsonb$$;
    create function public.is_admin() returns boolean language sql as $$select true$$;
    create function public.is_member() returns boolean language sql as $$select true$$;`);
  const schema=await readFile(new URL('../../supabase/migrations/001_initial_schema.sql',import.meta.url),'utf8');
  await db.exec(schema.slice(schema.indexOf('create table if not exists public.members'),schema.indexOf('alter table public.bookings\n  add constraint bookings_no_overlap')));
  await db.exec('create sequence public.invoice_number_seq');
  for(const filename of ['011_atomic_invoice_numbers.sql','20260906183145_invoice_reliability_and_portal_safety.sql']) {
    await db.exec(await readFile(new URL(`../../supabase/migrations/${filename}`,import.meta.url),'utf8'));
  }
  await db.exec(`insert into auth.users values('${admin}'),('${tenant}'),('${staff}'),('${second}');
    insert into members(id,email,name,role,billing_address,monthly_rent_net,contract_start) values
    ('${admin}','admin@example.test','Admin','admin',null,null,null),
    ('${tenant}','tenant@example.test','Tenant','member','Address',69,'2024-01-01'),
    ('${staff}','staff@example.test','Staff','employee',null,null,null),
    ('${second}','second@example.test','Second','employee',null,null,null);`);
  if(withExistingInvoice) await db.query('select create_monthly_invoice($1,$2,$3)',[tenant,'2024-01-01',admin]);
  const before=JSON.stringify((await db.query('select to_jsonb(i) row from invoices i union all select to_jsonb(i) from invoice_items i union all select to_jsonb(i) from invoice_snapshots i')).rows);
  await db.exec(await readFile(new URL('../../supabase/migrations/20260907201350_meeting_package_terms.sql',import.meta.url),'utf8'));
  const after=JSON.stringify((await db.query('select to_jsonb(i) row from invoices i union all select to_jsonb(i) from invoice_items i union all select to_jsonb(i) from invoice_snapshots i')).rows);
  assert.equal(after,before,'Migration must not alter existing financial records');
  return db;
}
async function month(db:PGlite, offset=0) {return (await db.query<{m:string}>(`select (date_trunc('month',now() at time zone 'Europe/Vienna')+make_interval(months=>$1))::date::text m`,[offset])).rows[0].m;}
async function set(db:PGlite,id:string,m:string,p:string,h:number,owner=id,by=admin){return db.query('select set_meeting_terms($1,$2,$3,$4,$5,$6)',[id,m,p,h,owner,by]);}
async function usage(db:PGlite,id:string,m:string){return (await db.query<{account_id:string,included_hours:string,used_hours:string,bonus_hours:string,package:string}>('select * from meeting_usage($1) where member_id=$2',[m,id])).rows[0];}
async function book(db:PGlite,id:string,m:string,h:number,day=2){return db.query(`insert into bookings(member_id,start_at,end_at) values($1,($2::date+($4::int-1)+time '08:00') at time zone 'Europe/Vienna',($2::date+($4::int-1)+time '08:00'+make_interval(hours=>$3::int)) at time zone 'Europe/Vienna')`,[id,m,h,day]);}

test('packages: unchanged list prices, 0/1/12 hours and zero-safe display',()=>{
  assert.deepEqual(['flex','fix','office','post','business'].map(k=>packages[k as keyof typeof packages].net),[180,250,590,39,69]);
  assert.equal(packages.business.hours,1); assert.equal(packages.post.hours,0);
  const member={id:tenant,name:'Test',email:'test@example.test',role:'member',plan:'pro',active:true,usedHours:0,bonusHours:0,includedHours:0,monthly_rent_net:39} satisfies ManagedMember;
  assert.equal(meetingSummary(member).progress,0);
  assert.equal(meetingSummary({...member,usedHours:2}).extraNet,24);
  assert.equal(meetingSummary({...member,includedHours:1,usedHours:2}).extraNet,12);
});

test('meeting terms: preserve legacy months, protect future invoices, never rewrite prices or numbers',async()=>{
  const db=await setup();
  try {
    const current=await month(db),next=await month(db,1);
    assert.equal(Number((await usage(db,tenant,'2024-01-01')).included_hours),12);
    await set(db,tenant,current,'business',1);
    assert.equal(Number((await usage(db,tenant,current)).included_hours),1);
    assert.equal(Number((await usage(db,tenant,'2024-01-01')).included_hours),12);
    await book(db,tenant,current,2);
    await assert.rejects(set(db,tenant,current,'post',0),/future_month_required/);
    await set(db,tenant,next,'post',0);
    assert.equal(Number((await usage(db,tenant,current)).included_hours),1);
    assert.equal(Number((await usage(db,tenant,next)).included_hours),0);
    const old=await db.query('select create_monthly_invoice($1,$2,$3) result',[tenant,'2024-01-01',admin]);
    const before=JSON.stringify((await db.query('select * from invoices')).rows);
    assert.ok(old.rows[0].result);
    await assert.rejects(set(db,tenant,'2024-01-01','post',0),/future_month_required/);
    assert.equal(JSON.stringify((await db.query('select * from invoices')).rows),before);
    await db.query(`insert into invoices(member_id,billing_month,issue_date,due_date,service_period_start,service_period_end,created_by) values($1,$2,$2,$2,$2,$2::date+27,$3)`,[tenant,next,admin]);
    await assert.rejects(set(db,tenant,next,'business',1),/future_invoice_exists/);
    assert.equal(Number((await db.query('select monthly_rent_net from members where id=$1',[tenant])).rows[0].monthly_rent_net),69);
  } finally {await db.close();}
});

test('meeting terms: shared logins consume one allowance, staff cap and bonus remain shared',async()=>{
  const db=await setup();
  try {
    const current=await month(db);
    await set(db,tenant,current,'business',1);
    await set(db,staff,current,'shared',0,tenant);
    await set(db,second,current,'shared',0,tenant);
    await book(db,staff,current,1);
    assert.equal(Number((await usage(db,tenant,current)).used_hours),1);
    assert.equal(Number((await usage(db,second,current)).included_hours),1);
    await assert.rejects(book(db,second,current,1,3),/employee_quota_exceeded/);
    await db.query('insert into quota_adjustments(member_id,valid_month,hours,reason,granted_by) values($1,$2,1,\'Test\',$3)',[staff,current,admin]);
    await book(db,second,current,1,3);
    assert.equal(Number((await usage(db,tenant,current)).bonus_hours),1);
    await book(db,tenant,current,1,4);
    assert.equal(Number((await usage(db,staff,current)).used_hours),3);
    await assert.rejects(set(db,staff,await month(db,1),'pro',12),/shared_account_locked/);
    await assert.rejects(db.query("update members set role='member',monthly_rent_net=10 where id=$1",[staff]),/shared_requires_employee/);
  } finally {await db.close();}
});

test('meeting terms: actual invoice uses historical quota and bills shared extra use only once',async()=>{
  const db=await setup();
  try {
    // Fixture-only historical terms bypass the future-only administrative setter.
    await db.query("insert into meeting_terms(member_id,effective_month,account_id,package,included_hours) values($1,'2024-01-01',$1,'business',1),($2,'2024-01-01',$1,'shared',0)",[tenant,staff]);
    await book(db,staff,'2024-01-01',1);
    await book(db,tenant,'2024-01-01',2,3);
    const result=(await db.query<{r:{id:string}}>('select create_monthly_invoice($1,$2,$3) r',[tenant,'2024-03-01',admin])).rows[0].r;
    const items=(await db.query<{quantity:string,unit_price_net:string,description:string}>('select quantity,unit_price_net,description from invoice_items where invoice_id=$1 order by sort_order',[result.id])).rows;
    assert.match(items[0].description,/Business-Standort/);
    assert.equal(Number(items[1].quantity),2); assert.equal(Number(items[1].unit_price_net),12);
    await db.query('select create_monthly_invoice($1,$2,$3)',[tenant,'2024-04-01',admin]);
    assert.equal((await db.query('select count(*)::int n from invoice_usage_periods')).rows[0].n,1);
    await db.exec('begin'); await set(db,tenant,await month(db,1),'custom',6); await db.exec('rollback');
    assert.equal(Number((await usage(db,tenant,await month(db,1))).included_hours),1);
  } finally {await db.close();}
});

test('meeting terms: roles, malformed packages, direct browser access and ownership chains rejected',async()=>{
  const db=await setup();
  try {
    const m=await month(db);
    await assert.rejects(set(db,tenant,m,'business',12),/package_hours_mismatch/);
    await assert.rejects(set(db,tenant,m,'custom',0.25),/invalid_hours/);
    await assert.rejects(set(db,tenant,m,'custom',1,tenant,staff),/admin_required/);
    await set(db,staff,m,'shared',0,tenant);
    await assert.rejects(set(db,second,m,'shared',0,staff),/invalid_account_owner/);
    for(const role of ['anon','authenticated']) {
      await db.exec(`set role ${role}`);
      await assert.rejects(db.exec('select * from meeting_terms'),/permission denied/);
      await assert.rejects(db.query('select * from meeting_usage($1)',[m]),/permission denied/);
      await assert.rejects(set(db,tenant,m,'business',1),/permission denied/);
      await db.exec('reset role');
    }
  } finally {await db.close();}
});

test('meeting terms: migration preserves finalized invoices and Post bills all meeting hours',async()=>{
  const db=await setup(true);
  try {
    const original=JSON.stringify((await db.query('select * from invoices where billing_month=\'2024-01-01\'')).rows);
    await db.query("insert into meeting_terms(member_id,effective_month,account_id,package,included_hours) values($1,'2024-02-01',$1,'post',0)",[tenant]);
    await book(db,tenant,'2024-02-01',2);
    const result=(await db.query<{r:{id:string}}>('select create_monthly_invoice($1,$2,$3) r',[tenant,'2024-04-01',admin])).rows[0].r;
    const items=(await db.query<{description:string,quantity:string}>('select description,quantity from invoice_items where invoice_id=$1 order by sort_order',[result.id])).rows;
    assert.match(items[0].description,/Postservice/);
    assert.equal(Number(items[1].quantity),2);
    assert.equal(JSON.stringify((await db.query('select * from invoices where billing_month=\'2024-01-01\'')).rows),original);
    const current=await month(db);
    await set(db,staff,current,'shared',0,tenant);
    await db.query('update members set active=false where id=$1',[tenant]);
    await assert.rejects(book(db,staff,current,1),/shared_account_inactive/);
  } finally {await db.close();}
});
