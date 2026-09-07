import { meetingAuth, meetingJson as json } from '@/lib/members/meeting-api';
import { smallJson, uuidPattern } from '@/lib/contacts/input';

function failure(message: string) {
  const reasons: Record<string, string> = { NOT_OVERDUE: 'Diese Rechnung ist nicht mehr offen und überfällig.', NO_RECIPIENT: 'Kein aktiver Rechnungsempfänger.', NO_ORIGINAL: 'Das Rechnungsoriginal fehlt. Bitte zuerst prüfen.', REMINDER_EXISTS: 'Eine Erinnerung wartet bereits, benötigt Prüfung oder wurde innerhalb der letzten sieben Tage versendet.', STALE_PREVIEW: 'Die Daten wurden inzwischen geändert. Bitte die Vorschau neu öffnen.' };
  return json({ error: Object.entries(reasons).find(([key]) => message.includes(key))?.[1] ?? 'Erinnerung konnte nicht verarbeitet werden.' }, 409);
}
export async function GET(request: Request) {
  try {
    const auth = await meetingAuth(request, true);
    if (!auth) return json({ error: 'Kein Zugriff.' }, 401);
    const id = new URL(request.url).searchParams.get('invoice') ?? '';
    if (!uuidPattern.test(id)) return json({ error: 'Ungültige Rechnung.' }, 400);
    const { data, error } = await auth.db.rpc('invoice_reminder_preview', { p_invoice: id, p_admin: auth.member.id });
    if (error) return failure(error.message);
    return json({ recipient: data.recipient, subject: data.subject, text: data.text, fingerprint: data.fingerprint });
  } catch { return json({ error: 'Vorschau nicht verfügbar.' }, 503); }
}
export async function POST(request: Request) {
  try {
    const auth = await meetingAuth(request, true);
    if (!auth) return json({ error: 'Kein Zugriff.' }, 401);
    const body = await smallJson(request) as Record<string, unknown>;
    if (!body || body.confirmed !== true || typeof body.invoice !== 'string' || !uuidPattern.test(body.invoice) || typeof body.id !== 'string' || !uuidPattern.test(body.id) || typeof body.fingerprint !== 'string' || !/^[a-f0-9]{32}$/.test(body.fingerprint)) return json({ error: 'Bitte Vorschau und Kontoeingang ausdrücklich bestätigen.' }, 400);
    const { data, error } = await auth.db.rpc('queue_invoice_reminder', { p_invoice: body.invoice, p_id: body.id, p_admin: auth.member.id, p_fingerprint: body.fingerprint });
    if (error) return failure(error.message);
    return json({ ok: true, id: data });
  } catch { return json({ error: 'Freigabe konnte nicht bestätigt werden. Bitte mit derselben Vorschau erneut versuchen.' }, 503); }
}
