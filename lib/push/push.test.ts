import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { PGlite } from '@electric-sql/pglite';
import { validDispatch } from './signature.ts';
import { validSubscription, pushPayload, pushEmails } from './validation.ts';

const julia = '00000000-0000-4000-8000-000000000001';
const roland = '00000000-0000-4000-8000-000000000002';
const tenant = '00000000-0000-4000-8000-000000000003';
const thirdAdmin = '00000000-0000-4000-8000-000000000004';
const subscription = { endpoint: 'https://web.push.apple.com/test', keys: { auth: 'a'.repeat(22), p256dh: 'a'.repeat(87) } };
const config = { publicKey: 'a'.repeat(87), privateKey: 'b'.repeat(43), dispatchSecret: 'c'.repeat(43) };

test('push: provider allowlist, minimal payload and expiring signed dispatcher', () => {
  assert.equal(pushEmails.size, 2);
  assert.equal(validSubscription(subscription), true);
  for (const endpoint of ['http://web.push.apple.com/x', 'https://web.push.apple.com.attacker.test/x', 'https://localhost/x', 'https://127.0.0.1/x', 'https://web.push.apple.com:444/x', 'https://x:y@web.push.apple.com/x', 'file:///tmp/x']) {
    assert.equal(validSubscription({ ...subscription, endpoint }), false, endpoint);
  }
  assert.equal(validSubscription({ ...subscription, keys: {} }), false);
  const stamp = '1788810000';
  const signature = createHmac('sha256', 'test-secret').update(stamp).digest('hex');
  assert.equal(validDispatch(stamp, signature, 'test-secret', Number(stamp) * 1000), true);
  assert.equal(validDispatch(stamp, signature, 'wrong', Number(stamp) * 1000), false);
  assert.equal(validDispatch(stamp, signature, 'test-secret', (Number(stamp) + 91) * 1000), false);
  assert.equal(validDispatch(stamp, 'x', 'test-secret'), false);
  assert.deepEqual(pushPayload(julia, false), { id: julia, title: 'AUFELD21', body: 'Neue Meldung im Portal. Bitte im Adminbereich ansehen.', url: '/portal?view=issues' });
});

async function setup() {
  const db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema notification_private; create schema vault; create schema net; create schema cron; create schema extensions;
    create table members(id uuid primary key,email text,role text,active boolean);
    insert into members values('${julia}','julia.potlog@gmail.com','admin',true),('${roland}','roland.potlog@gmail.com','admin',true),
      ('${tenant}','tenant@example.test','member',true),('${thirdAdmin}','other@example.test','admin',true);
    create table issue_reports(id uuid primary key default gen_random_uuid(),status text default 'open');
    grant select on members,issue_reports to service_role;
    create table vault.decrypted_secrets(name text unique,decrypted_secret text);
    create function vault.create_secret(secret text,name text,description text) returns uuid language sql as $$
      insert into vault.decrypted_secrets values(name,secret); select gen_random_uuid(); $$;
    create function cron.schedule(text,text,text) returns bigint language sql as $$select 1::bigint$$;
    create table net.requests(id bigserial,url text,body jsonb,headers jsonb);
    create function net.http_post(url text,body jsonb,headers jsonb,timeout_milliseconds int) returns bigint language sql as $$
      insert into net.requests(url,body,headers) values(url,body,headers) returning id $$;
    create function extensions.hmac(text,text,text) returns bytea language sql as $$select decode('01','hex')$$;
    insert into issue_reports default values;
  `);
  await db.exec(await readFile(new URL('../../supabase/migrations/20260907193753_admin_web_push.sql', import.meta.url), 'utf8'));
  await db.exec(await readFile(new URL('../../supabase/migrations/20260907195956_push_subscription_ownership_guard.sql', import.meta.url), 'utf8'));
  return db;
}
async function register(db: PGlite, member = julia, endpoint = subscription.endpoint) {
  return (await db.query<{id:string}>('select push_register($1,$2) id', [member, { ...subscription, endpoint }])).rows[0].id;
}
async function issue(db: PGlite) { return (await db.query<{id:string}>('insert into issue_reports default values returning id')).rows[0].id; }
async function count(db: PGlite) { return (await db.query<{n:number}>('select count(*)::int n from push_notifications')).rows[0].n; }
type Claimed = {job_id:string,lease:string,subscription_id:string,is_test:boolean};
async function claim(db:PGlite) { return (await db.query<Claimed>('select * from push_claim()')).rows; }

test('push database: exactly two admins, opt-in, no backfill, rollback, protected RPC and Vault', async () => {
  const db = await setup();
  try {
    assert.equal(await count(db),0);
    await issue(db); assert.equal(await count(db),0,'no devices means no push');
    await assert.rejects(register(db,tenant),/not authorized/);
    await assert.rejects(register(db,thirdAdmin),/not authorized/);
    const id = await register(db); assert.equal(await register(db),id,'register is idempotent');
    await assert.rejects(register(db,roland),/another account/);
    await register(db,roland,'https://fcm.googleapis.com/test');
    await db.exec('begin'); await issue(db); await db.exec('rollback'); assert.equal(await count(db),0);
    await issue(db); assert.equal(await count(db),2);
    await db.query('update members set active=false where id=$1',[roland]);
    const jobs=await claim(db); assert.equal(jobs.length,1,'deactivated admin excluded before dispatch');
    await db.exec('set role service_role');
    await assert.rejects(db.query('select push_config($1)',[{}]),/Invalid/);
    const key=(await db.query<{cfg:unknown}>('select push_config($1) cfg',[config])).rows[0].cfg;
    assert.deepEqual(key,config);
    assert.deepEqual((await db.query<{cfg:unknown}>('select push_config($1) cfg',[{...config,privateKey:'z'.repeat(43)}])).rows[0].cfg,config,'keys are never silently rotated');
    for (const role of ['anon','authenticated']) {
      await db.exec('reset role'); await db.exec(`set role ${role}`);
      await assert.rejects(db.exec('select * from push_subscriptions'),/permission denied/);
      await assert.rejects(db.exec('select push_config()'),/permission denied/);
      await assert.rejects(db.exec('select * from push_claim()'),/permission denied/);
    }
  } finally { await db.close(); }
});

test('push database: device cap also covers reactivation without blocking idempotent renewal', async () => {
  const db=await setup();
  try {
    const original=await register(db);
    await db.query('update push_subscriptions set active=false where id=$1',[original]);
    for(let i=0;i<10;i++) await register(db,julia,`https://web.push.apple.com/test-${i}`);
    await assert.rejects(register(db),/limit reached/);
    await assert.rejects(register(db,julia,'https://web.push.apple.com/eleven'),/limit reached/);
    assert.ok(await register(db,julia,'https://web.push.apple.com/test-0'));
  } finally {await db.close();}
});

test('push database: leases, bounded retries, stale acknowledgements and expired devices', async () => {
  const db=await setup();
  try {
    await register(db); await issue(db);
    const [job]=await claim(db); assert.equal((await claim(db)).length,0,'cannot claim twice');
    await db.query('select push_finish($1,$2,$3)',[job.job_id,job.lease,'retry']);
    assert.equal((await claim(db)).length,0,'retry is deferred');
    await db.exec("update push_notifications set available_at=now()-interval '1 minute'");
    const [retry]=await claim(db); assert.notEqual(retry.lease,job.lease);
    await db.query('select push_finish($1,$2,$3)',[job.job_id,job.lease,'sent']);
    assert.equal((await db.query<{status:string}>('select status from push_notifications')).rows[0].status,'processing','stale lease ignored');
    await db.query('select push_finish($1,$2,$3)',[retry.job_id,retry.lease,'gone']);
    assert.equal((await db.query<{active:boolean}>('select active from push_subscriptions')).rows[0].active,false);
    await register(db); const resolved=await issue(db);
    await db.query("update issue_reports set status='resolved' where id=$1",[resolved]);
    assert.equal((await claim(db)).length,0,'resolved reports are skipped');
    await issue(db); await claim(db);
    await db.exec("update push_notifications set attempted_at=now()-interval '3 minutes' where status='processing'");
    assert.equal((await claim(db)).length,1,'worker crash can recover');
    await db.exec("update push_notifications set attempts=3,attempted_at=now()-interval '3 minutes' where status='processing'");
    assert.equal((await claim(db)).length,0,'retries stop');
  } finally { await db.close(); }
});

test('push database: self-test throttle and private signed wake-up',async()=>{
  const db=await setup();
  try {
    await register(db);
    await db.query('select push_config($1)',[config]);
    const query='select push_test($1,$2) id';
    assert.ok((await db.query<{id:string|null}>(query,[julia,subscription.endpoint])).rows[0].id);
    assert.equal((await db.query<{id:string|null}>(query,[julia,subscription.endpoint])).rows[0].id,null);
    assert.equal((await db.query<{id:string|null}>(query,[roland,subscription.endpoint])).rows[0].id,null);
    await db.exec('select notification_private.dispatch_push()');
    const req=(await db.query<{body:unknown,headers:Record<string,string>}>('select body,headers from net.requests')).rows[0];
    assert.ok(req.headers['X-Push-Signature']);
    assert.doesNotMatch(JSON.stringify(req),new RegExp(config.privateKey+'|'+config.dispatchSecret));
  } finally {await db.close();}
});

test('service worker: duplicate push displays once and click stays on own portal',async()=>{
  const handlers:Record<string,(e:unknown)=>void>={};
  const shown:unknown[]=[]; const stored=new Map(); let opened='';
  const cache={match:async(k:Request)=>stored.get(k.url),put:async(k:Request,v:Response)=>stored.set(k.url,v),keys:async()=>[...stored.keys()].map(k=>new Request(k)),delete:async(k:Request)=>stored.delete(k.url)};
  runInNewContext(await readFile(new URL('../../public/push-worker.js',import.meta.url),'utf8'),{
    self:{addEventListener:(name:string,fn:(e:unknown)=>void)=>{handlers[name]=fn;},location:{origin:'https://www.aufeld21.at'},registration:{showNotification:async(...args:unknown[])=>{shown.push(args);}},clients:{matchAll:async()=>[],openWindow:async(url:string)=>{opened=url;}}},
    caches:{open:async()=>cache},Request,Response,URL,Promise,
  });
  for(let i=0;i<2;i++){let work:Promise<unknown>|undefined; handlers.push({data:{json:()=>({...pushPayload(julia,false),url:'https://attacker.test'})},waitUntil:(p:Promise<unknown>)=>{work=p;}}); await work;}
  assert.equal(shown.length,1);
  let click:Promise<unknown>|undefined;
  handlers.notificationclick({notification:{close:()=>{}},waitUntil:(p:Promise<unknown>)=>{click=p;}}); await click;
  assert.equal(opened,'https://www.aufeld21.at/portal?view=issues');
});
