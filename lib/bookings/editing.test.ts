import test from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import { bookingDraft, bookingEditError, bookingHoursInMonth, bookingSaveError, bookingValues, movedBookingDraft, updateOwnBooking } from './editing.ts';

const now = Date.parse('2026-11-19T10:00:00Z');
const member = { id: 'owner', active: true };
const booking = { id: 'booking', member_id: 'owner', start_at: '2026-11-23T10:30:00Z', end_at: '2026-11-23T12:00:00Z', note: null };
const draft = { date: '2026-11-24', start: '13:00', end: '14:30', note: ' Meeting ' };

test('edit permission: active owner only, strictly before original start', () => {
  assert.equal(bookingEditError(booking, member, now), null);
  for (const who of [null, { ...member, active: false }, { id: 'other', active: true }]) assert.match(bookingEditError(booking, who, now)!, /eigenen/);
  assert.match(bookingEditError(booking, member, Date.parse(booking.start_at))!, /Begonnene/);
});

test('Vienna dates, duration preservation, 30-minute snapping and grid boundaries', () => {
  assert.deepEqual(bookingDraft(booking), { date: '2026-11-23', start: '11:30', end: '13:00', note: '' });
  assert.deepEqual(movedBookingDraft(booking, '2026-12-01', 4.6), { date: '2026-12-01', start: '09:30', end: '11:00', note: '' });
  assert.equal(movedBookingDraft(booking, draft.date, -10).start, '07:00');
  assert.equal(movedBookingDraft(booking, draft.date, 40).end, '20:00');
  assert.equal(bookingHoursInMonth(booking, '2026-11'), 1.5);
  assert.equal(bookingHoursInMonth(booking, '2026-12'), 0);
  assert.equal(bookingValues(draft, now).start_at, '2026-11-24T12:00:00.000Z');
  const summer = { ...draft, date: '2027-07-01' };
  assert.equal(bookingValues(summer, now).start_at, '2027-07-01T11:00:00.000Z');
  for (const bad of [{ date: 'bad' }, { date: '2027-02-31' }, { date: '2026-11-18' }, { start: '06:30' }, { end: '20:30' }, { start: '13:15' }, { end: '13:00' }, { note: 'x'.repeat(121) }]) assert.throws(() => bookingValues({ ...draft, ...bad }, now));
});

function fakeDb(result: { data: typeof booking | null; error: { code?: string; message: string } | null }, reject = false) {
  const calls: unknown[][] = [];
  const query = {
    eq: (key: string, value: unknown) => { calls.push(['eq', key, value]); return query; },
    is: (key: string, value: unknown) => { calls.push(['is', key, value]); return query; },
    gt: (key: string, value: unknown) => { calls.push(['gt', key, value]); return query; },
    select: (value: string) => { calls.push(['select', value]); return query; },
    maybeSingle: async () => { if (reject) throw new Error('offline'); return result; },
  };
  return { calls, db: { from: (table: string) => { calls.push(['from', table]); return { update: (value: unknown) => { calls.push(['update', value]); return query; } }; } } as unknown as SupabaseClient };
}

test('update is atomic, filtered by owner and original version, and requires a returned row', async () => {
  const fake = fakeDb({ data: booking, error: null });
  assert.equal((await updateOwnBooking(fake.db, booking, member, draft, now)).id, booking.id);
  assert.deepEqual(fake.calls.slice(0, 8), [
    ['from', 'bookings'], ['update', bookingValues(draft, now)], ['eq', 'id', booking.id], ['eq', 'member_id', member.id],
    ['eq', 'start_at', booking.start_at], ['eq', 'end_at', booking.end_at], ['gt', 'start_at', new Date(now).toISOString()], ['is', 'note', null],
  ]);
  const denied = fakeDb({ data: booking, error: null });
  await assert.rejects(updateOwnBooking(denied.db, booking, { ...member, active: false }, draft, now), /eigenen/);
  assert.equal(denied.calls.length, 0);
  await assert.rejects(updateOwnBooking(fakeDb({ data: null, error: null }).db, booking, member, draft, now), /inzwischen/);
  await assert.rejects(updateOwnBooking(fakeDb({ data: null, error: { code: '23P01', message: 'overlap' } }).db, booking, member, draft, now), /schon gebucht/);
  await assert.rejects(updateOwnBooking(fakeDb({ data: null, error: null }, true).db, booking, member, draft, now), /Verbindungsfehlers/);
  assert.match(bookingSaveError({ message: 'employee_quota_exceeded' }), /Monatskontingent/);
  assert.match(bookingSaveError({ message: 'booking_usage_billed' }), /abgerechnet/);
});
