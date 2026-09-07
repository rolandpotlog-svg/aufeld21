import { formatInTimeZone } from 'date-fns-tz';
import { meetingAuth, meetingJson } from '@/lib/members/meeting-api';
import { isBillingMonth } from '@/lib/invoices/billing';
import type { MeetingUsage } from '@/lib/members/packages';

export async function GET(request: Request) {
  try {
    const auth = await meetingAuth(request);
    if (!auth) return meetingJson({ error: 'Bitte anmelden.' }, 401);
    const month = new URL(request.url).searchParams.get('month') || formatInTimeZone(new Date(), 'Europe/Vienna', 'yyyy-MM-01');
    if (!isBillingMonth(month)) return meetingJson({ error: 'Ungültiger Monat.' }, 400);
    const { data, error } = await auth.db.rpc('meeting_usage', { target_month: month });
    if (error) throw error;
    const usage = (data as MeetingUsage[]).find(row => row.member_id === auth.member.id);
    if (!usage) throw new Error('Missing quota');
    return meetingJson({ usage });
  } catch { return meetingJson({ error: 'Das Meetingkontingent konnte nicht geladen werden.' }, 503); }
}
