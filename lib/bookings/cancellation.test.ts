import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import type { SupabaseClient } from '@supabase/supabase-js';
import { bookingCancellationError, cancelOwnBooking } from './cancellation.ts';

const now = Date.parse('2026-09-14T08:00:00Z');
const member = { id: 'member-1', active: true };
const booking = { id: 'booking-1', member_id: member.id, start_at: '2026-09-14T10:00:00Z' };

function fakeDb(result: { data: { id: string } | null; error: object | null }, reject = false) {
  const calls: unknown[][] = [];
  const filter = {
    eq: (field: string, value: string) => { calls.push(['eq', field, value]); return filter; },
    gt: (field: string, value: string) => { calls.push(['gt', field, value]); return filter; },
    select: (columns: string) => { calls.push(['select', columns]); return filter; },
    maybeSingle: async () => { if (reject) throw new Error('network_failure'); return result; },
  };
  const db = { from: (table: string) => { calls.push(['from', table]); return { delete: () => { calls.push(['delete']); return filter; } }; } };
  return { db: db as unknown as SupabaseClient, calls };
}

test('cancellation permits only an active owner before the start, including timezone offsets', () => {
  assert.equal(bookingCancellationError(booking, member, now), null);
  for (const identity of [null, { ...member, active: false }, { id: 'other-member', active: true }]) {
    assert.match(bookingCancellationError(booking, identity, now)!, /eigenen Buchungen/);
  }
  for (const start_at of ['2026-09-14T08:00:00Z', '2026-09-14T09:00:00+02:00', 'invalid']) {
    assert.match(bookingCancellationError({ ...booking, start_at }, member, now)!, /Begonnene oder vergangene/);
  }
  assert.equal(bookingCancellationError({ ...booking, start_at: '2026-09-14T10:00:01+02:00' }, member, now), null);
});

test('cancellation checks permission again at confirmation and never calls the database for denied requests', async () => {
  const { db, calls } = fakeDb({ data: { id: booking.id }, error: null });
  await assert.rejects(cancelOwnBooking(db, booking, member, Date.parse(booking.start_at)), /Begonnene/);
  await assert.rejects(cancelOwnBooking(db, booking, { ...member, active: false }, now), /eigenen/);
  await assert.rejects(cancelOwnBooking(db, booking, { id: 'other', active: true }, now), /eigenen/);
  assert.deepEqual(calls, []);
});

test('cancellation is filtered by ID, owner and future start and verifies the returned ID', async () => {
  const { db, calls } = fakeDb({ data: { id: booking.id }, error: null });
  await cancelOwnBooking(db, booking, member, now);
  assert.deepEqual(calls, [['from', 'bookings'], ['delete'], ['eq', 'id', booking.id], ['eq', 'member_id', member.id], ['gt', 'start_at', new Date(now).toISOString()], ['select', 'id']]);
  for (const result of [{ data: null, error: null }, { data: null, error: { code: '42501' } }, { data: { id: 'wrong' }, error: null }]) {
    await assert.rejects(cancelOwnBooking(fakeDb(result).db, booking, member, now), /konnte nicht storniert/);
  }
  await assert.rejects(cancelOwnBooking(fakeDb({ data: null, error: null }, true).db, booking, member, now), /Verbindungsfehlers/);
});

test('existing booking RLS: only active owners cancel future bookings; past evidence survives; quota drops by the cancelled hours', async () => {
  // Isolated Postgres only: no production appointments are created or removed.
  const db = new PGlite();
  const owner = '00000000-0000-4000-8000-000000000001';
  const other = '00000000-0000-4000-8000-000000000002';
  const inactive = '00000000-0000-4000-8000-000000000003';
  try {
    await db.exec(`
      create role anon; create role authenticated;
      create schema auth;
      grant usage on schema auth to authenticated;
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      create table public.members(id uuid primary key, active boolean not null);
      create function public.is_member() returns boolean language sql stable security definer set search_path=public as $$select exists(select 1 from members where id=auth.uid() and active)$$;
      create table public.bookings(id text primary key, member_id uuid not null, start_at timestamptz not null, end_at timestamptz not null);
      alter table public.bookings enable row level security;
      grant select,insert,delete on public.bookings to authenticated;
      insert into public.members values ('${owner}',true),('${other}',true),('${inactive}',false);
      insert into public.bookings values
        ('future','${owner}',now()+interval '1 day',now()+interval '1 day 2 hours'),
        ('other','${other}',now()+interval '1 day',now()+interval '1 day 1 hour'),
        ('past','${owner}',now()-interval '2 hours',now()-interval '1 hour'),
        ('started','${owner}',now()-interval '1 hour',now()+interval '1 hour'),
        ('inactive','${inactive}',now()+interval '1 day',now()+interval '1 day 1 hour');
    `);
    const initial = await readFile(new URL('../../supabase/migrations/001_initial_schema.sql', import.meta.url), 'utf8');
    const hardened = await readFile(new URL('../../supabase/migrations/20260906183145_invoice_reliability_and_portal_safety.sql', import.meta.url), 'utf8');
    // Use the actual shipped policies, not a duplicate hardcoded allow/deny rule.
    await db.exec(initial.slice(initial.indexOf('create policy "Authenticated members can read all bookings"'), initial.indexOf('create policy "Members can create issue reports"')));
    await db.exec(hardened.slice(hardened.indexOf('-- Finished bookings are billing evidence.')));
    await db.exec('set role anon');
    await assert.rejects(db.query("delete from bookings where id='future' returning id"), /permission denied/);
    await db.exec('reset role; set role authenticated');
    const identify = async (id: string) => { await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]); };
    const remove = (id: string) => db.query('delete from bookings where id=$1 returning id', [id]);
    for (const id of ['', '00000000-0000-4000-8000-000000000099', other, inactive]) {
      await identify(id);
      assert.equal((await remove(id === inactive ? 'inactive' : 'future')).rows.length, 0);
    }
    await identify(owner);
    for (const id of ['other', 'past', 'started']) assert.equal((await remove(id)).rows.length, 0);
    const hours = async () => Number((await db.query<{ hours: string }>('select sum(extract(epoch from (end_at-start_at))/3600) as hours from bookings where member_id=auth.uid()')).rows[0].hours);
    const before = await hours();
    assert.deepEqual((await remove('future')).rows, [{ id: 'future' }]);
    assert.equal(before - await hours(), 2);
    assert.equal((await remove('future')).rows.length, 0, 'second cancellation does not credit hours again');
    assert.equal((await db.query("select id from bookings where id in ('past','started')")).rows.length, 2);
  } finally { await db.close(); }
});
