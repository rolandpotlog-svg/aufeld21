import type { SupabaseClient } from '@supabase/supabase-js';

type Booking = { id: string; member_id: string; start_at: string };
type Member = { id: string; active: boolean };

export function bookingCancellationError(booking: Booking, member: Member | null, now = Date.now()): string | null {
  if (!member?.active || booking.member_id !== member.id) return 'Du kannst nur deine eigenen Buchungen stornieren.';
  if (!(Date.parse(booking.start_at) > now)) return 'Begonnene oder vergangene Buchungen können nicht storniert werden.';
  return null;
}

export async function cancelOwnBooking(db: SupabaseClient, booking: Booking, member: Member | null, now = Date.now()) {
  const blocked = bookingCancellationError(booking, member, now);
  if (blocked) throw new Error(blocked);
  // Keep all filters even though RLS enforces ownership, active membership and
  // start_at > now() independently. A zero-row response is not a successful cancellation.
  let result;
  try {
    result = await db.from('bookings').delete()
      .eq('id', booking.id).eq('member_id', member!.id).gt('start_at', new Date(now).toISOString())
      .select('id').maybeSingle();
  } catch {
    throw new Error('Die Stornierung konnte wegen eines Verbindungsfehlers nicht bestätigt werden. Bitte aktualisiere den Kalender, bevor du es erneut versuchst.');
  }
  const { data, error } = result;
  if (error || data?.id !== booking.id) {
    throw new Error('Die Buchung konnte nicht storniert werden. Sie wurde möglicherweise bereits entfernt oder hat inzwischen begonnen. Bitte aktualisiere den Kalender und versuche es erneut.');
  }
}
