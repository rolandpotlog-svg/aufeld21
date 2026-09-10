import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('Wi-Fi: active members read credentials; outsiders and inactive accounts cannot; all clients are read-only', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth;
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
      $$;
      create table public.members(id uuid primary key, active boolean not null);
      create function public.is_member() returns boolean language sql stable security definer set search_path=public as $$
        select exists(select 1 from public.members where id=auth.uid() and active=true);
      $$;
      insert into public.members values
        ('00000000-0000-4000-8000-000000000001', true),
        ('00000000-0000-4000-8000-000000000002', false);
    `);
    const directory = new URL('../../supabase/migrations/', import.meta.url);
    const migration = (await readdir(directory)).find(name => name.endsWith('_member_wifi_access.sql'));
    assert.ok(migration);
    await db.exec(await readFile(new URL(migration, directory), 'utf8'));
    // Fictional fixtures only. Real Wi-Fi credentials are never in source or tests.
    await db.query('insert into public.space_wifi values ($1,$2,$3)', ['tenant', 'Test WLAN', 'Test-Wifi-Only']);
    await db.exec('set role anon');
    await assert.rejects(db.query('select * from public.space_wifi'), /permission denied/);
    await db.exec('reset role; set role authenticated');
    for (const id of ['', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000003']) {
      await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id]);
      assert.equal((await db.query('select * from public.space_wifi')).rows.length, 0);
    }
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", ['00000000-0000-4000-8000-000000000001']);
    assert.deepEqual((await db.query('select ssid,password from public.space_wifi')).rows, [{ ssid: 'Test WLAN', password: 'Test-Wifi-Only' }]);
    for (const sql of ["insert into public.space_wifi values ('tenant','Other','Test-Other')", "update public.space_wifi set password='Test-Other'", 'delete from public.space_wifi']) {
      await assert.rejects(db.exec(sql), /permission denied/);
    }
    await db.exec('reset role');
    await db.exec("update public.members set active=false where id='00000000-0000-4000-8000-000000000001'");
    await db.exec('set role authenticated');
    assert.equal((await db.query('select * from public.space_wifi')).rows.length, 0, 'deactivation takes effect without waiting for a new token');
  } finally { await db.close(); }
});
