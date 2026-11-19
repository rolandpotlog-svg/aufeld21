import type { SupabaseClient } from '@supabase/supabase-js';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';

export const BOOKING_TZ = 'Europe/Vienna';
export type EditableBooking = { id: string; member_id: string; start_at: string; end_at: string; note: string | null };
export type BookingDraft = { date: string; start: string; end: string; note: string };
type Member = { id: string; active: boolean };

export function bookingEditError(booking: EditableBooking, member: Member | null, now = Date.now()) {
  if (!member?.active || booking.member_id !== member.id) return 'Du kannst nur deine eigenen Buchungen ändern.';
  if (!(Date.parse(booking.start_at) > now)) return 'Begonnene oder vergangene Buchungen können nicht geändert werden.';
  return null;
}

export function bookingDraft(booking: EditableBooking): BookingDraft {
  return { date: formatInTimeZone(booking.start_at, BOOKING_TZ, 'yyyy-MM-dd'), start: formatInTimeZone(booking.start_at, BOOKING_TZ, 'HH:mm'), end: formatInTimeZone(booking.end_at, BOOKING_TZ, 'HH:mm'), note: booking.note ?? '' };
}

export function bookingValues(draft: BookingDraft, now = Date.now()) {
  const start = fromZonedTime(`${draft.date} ${draft.start}:00`, BOOKING_TZ);
  const end = fromZonedTime(`${draft.date} ${draft.end}:00`, BOOKING_TZ);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.date) || !Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start.getTime() <= now) throw new Error('Bitte wähle einen zukünftigen Zeitraum.');
  if (end <= start) throw new Error('Die Endzeit muss nach der Startzeit liegen.');
  if (!/^(?:0[7-9]|1\d):(00|30)$/.test(draft.start) || !/^(?:(?:0[7-9]|1\d):(00|30)|20:00)$/.test(draft.end)) throw new Error('Bitte wähle halbstündige Zeiten zwischen 07:00 und 20:00 Uhr.');
  if (formatInTimeZone(start, BOOKING_TZ, 'yyyy-MM-dd') !== draft.date) throw new Error('Bitte wähle ein gültiges Datum.');
  if (draft.note.trim().length > 120) throw new Error('Die Notiz darf höchstens 120 Zeichen lang sein.');
  return { start_at: start.toISOString(), end_at: end.toISOString(), note: draft.note.trim() || null };
}

export function bookingHoursInMonth(booking: Pick<EditableBooking, 'start_at' | 'end_at'> | null, month: string) {
  return booking && formatInTimeZone(booking.start_at, BOOKING_TZ, 'yyyy-MM') === month ? (Date.parse(booking.end_at) - Date.parse(booking.start_at)) / 3_600_000 : 0;
}

// Keep the grabbed point under the pointer, snap to half hours and retain duration.
export function movedBookingDraft(booking: EditableBooking, date: string, slot: number): BookingDraft {
  const duration = (Date.parse(booking.end_at) - Date.parse(booking.start_at)) / 60_000;
  const minutes = Math.max(7 * 60, Math.min(20 * 60 - duration, 7 * 60 + Math.round(slot) * 30));
  const time = (value: number) => `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
  return { date, start: time(minutes), end: time(minutes + duration), note: booking.note ?? '' };
}

export function bookingSaveError(error: { code?: string; message: string }) {
  if (error.code === '23P01' || error.message.includes('bookings_no_overlap')) return 'Der Raum ist in diesem Zeitraum schon gebucht. Bitte wähle eine freie Zeit.';
  if (error.message.includes('employee_quota_exceeded')) return 'Dein Monatskontingent reicht dafür nicht aus. Bitte wende dich für Bonusstunden an Roland.';
  if (error.message.includes('shared_account_inactive')) return 'Das zugehörige Hauptkonto ist deaktiviert. Bitte wende dich an die Verwaltung.';
  if (error.message.includes('booking_usage_billed')) return 'Dieser Zeitraum wurde bereits abgerechnet und kann nicht mehr geändert werden.';
  return 'Die Buchung konnte nicht gespeichert werden. Bitte aktualisiere den Kalender und versuche es erneut.';
}

export async function updateOwnBooking<T extends EditableBooking>(db: SupabaseClient, booking: T, member: Member | null, draft: BookingDraft, now = Date.now()): Promise<T> {
  const blocked = bookingEditError(booking, member, now);
  if (blocked) throw new Error(blocked);
  const values = bookingValues(draft, now);
  let result;
  try {
    // Compare the original values as well: a stale dialog must not overwrite
    // another device's changes. No delete/recreate and no change of owner/ID.
    let query = db.from('bookings').update(values)
      .eq('id', booking.id).eq('member_id', member!.id)
      .eq('start_at', booking.start_at).eq('end_at', booking.end_at)
      .gt('start_at', new Date(now).toISOString());
    query = booking.note === null ? query.is('note', null) : query.eq('note', booking.note);
    result = await query.select('id,member_id,start_at,end_at,note,members(name)').maybeSingle();
  } catch {
    throw new Error('Die Änderung konnte wegen eines Verbindungsfehlers nicht bestätigt werden. Bitte aktualisiere zuerst den Kalender.');
  }
  if (result.error) throw new Error(bookingSaveError(result.error));
  if (result.data?.id !== booking.id) throw new Error('Der Termin wurde inzwischen geändert, storniert oder hat bereits begonnen. Bitte schließe dieses Fenster und aktualisiere den Kalender.');
  return result.data as T;
}
