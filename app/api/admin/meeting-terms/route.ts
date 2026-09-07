import { formatInTimeZone } from 'date-fns-tz';
import { isBillingMonth } from '@/lib/invoices/billing';
import { meetingAuth, meetingJson } from '@/lib/members/meeting-api';
import { isPackageId } from '@/lib/members/packages';

const errors: Record<string, string> = {
  future_month_required: 'Bei bereits genutzten Konten ist eine Änderung frühestens ab dem nächsten Monat möglich.',
  future_invoice_exists: 'Für diesen oder einen späteren Monat bestehen bereits Rechnungen. Wähle einen Monat nach der letzten bestehenden Rechnung.',
  shared_requires_employee: 'Ein Zusatzlogin muss als Mitarbeiter ohne eigene Grundmiete angelegt sein.',
  shared_requires_unused_account: 'Dieser Zugang wurde bereits genutzt. Seine bisherige Abrechnung darf nicht nachträglich einem anderen Konto zugeordnet werden.',
  shared_account_locked: 'Ein bereits genutzter Zusatzlogin kann nicht nachträglich umgebucht werden.',
  invalid_account_owner: 'Bitte ein aktives Hauptkonto auswählen, das kein fremdes Kontingent mitnutzt.',
  account_has_dependents: 'Dieses Hauptkonto hat bereits Zusatzlogins und kann nicht selbst zum Zusatzlogin werden.',
  package_hours_mismatch: 'Die Stunden passen nicht zum gewählten Paket.',
};

export async function GET(request: Request) {
  try {
    const auth = await meetingAuth(request, true);
    if (!auth) return meetingJson({ error: 'Nur für aktive Administratoren.' }, 403);
    const memberId = new URL(request.url).searchParams.get('member');
    if (!memberId) return meetingJson({ error: 'Mitglied fehlt.' }, 400);
    const month = formatInTimeZone(new Date(), 'Europe/Vienna', 'yyyy-MM-01');
    const [terms, owners, usage] = await Promise.all([
      auth.db.from('meeting_terms').select('effective_month,account_id,package,included_hours').eq('member_id', memberId).order('effective_month', { ascending: false }),
      auth.db.from('members').select('id,name,billing_name').eq('active', true).neq('role', 'employee').order('name'),
      auth.db.rpc('meeting_usage', { target_month: month }),
    ]);
    if (terms.error || owners.error || usage.error) throw new Error('Terms unavailable');
    return meetingJson({ terms: terms.data, owners: owners.data, currentMonth: month, usage: usage.data.find((row: { member_id: string }) => row.member_id === memberId) });
  } catch { return meetingJson({ error: 'Kontingente sind gerade nicht erreichbar.' }, 503); }
}

export async function POST(request: Request) {
  try {
    const auth = await meetingAuth(request, true);
    if (!auth) return meetingJson({ error: 'Nur für aktive Administratoren.' }, 403);
    const raw = await request.text();
    if (raw.length > 4096) return meetingJson({ error: 'Anfrage zu groß.' }, 413);
    const body = JSON.parse(raw);
    if (!body.memberId || !body.accountId || !isPackageId(body.package) || !isBillingMonth(body.month)
      || typeof body.hours !== 'number' || !Number.isFinite(body.hours) || body.hours < 0 || body.hours > 168 || body.hours % 0.5) {
      return meetingJson({ error: 'Bitte gültiges Paket, Monat und Stunden eingeben.' }, 400);
    }
    const { error } = await auth.db.rpc('set_meeting_terms', {
      target_member: body.memberId, target_month: body.month, target_package: body.package,
      target_hours: body.hours, target_account: body.accountId, creator_id: auth.member.id,
    });
    if (error) return meetingJson({ error: errors[error.message] || 'Das Kontingent konnte nicht gespeichert werden. Bitte die Zuordnung prüfen.' }, 409);
    return meetingJson({ ok: true });
  } catch { return meetingJson({ error: 'Kontingent konnte nicht gespeichert werden.' }, 503); }
}
