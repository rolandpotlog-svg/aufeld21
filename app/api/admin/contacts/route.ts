import { meetingAuth, meetingJson as json } from '@/lib/members/meeting-api';
import { smallJson, uuidPattern } from '@/lib/contacts/input';

export async function PATCH(request: Request) {
  try {
    const auth = await meetingAuth(request, true);
    if (!auth) return json({ error: 'Kein Zugriff.' }, 401);
    const body = await smallJson(request, 32000) as Record<string, unknown>;
    if (!body || typeof body.id !== 'string' || !uuidPattern.test(body.id) || !['new', 'appointment', 'done'].includes(String(body.status)) || typeof body.notes !== 'string' || body.notes.length > 5000 || !Number.isSafeInteger(body.version) || Number(body.version) < 1) return json({ error: 'Ungültige Angaben.' }, 400);
    const { data, error } = await auth.db.from('contact_requests').update({ status: body.status, notes: body.notes, updated_at: new Date().toISOString(), updated_by: auth.member.id, version: Number(body.version) + 1 }).eq('id', body.id).eq('version', body.version).select('id').maybeSingle();
    if (error) throw error;
    if (!data) return json({ error: 'Die Anfrage wurde inzwischen geändert. Bitte neu laden und Änderungen prüfen.' }, 409);
    return json({ ok: true });
  } catch { return json({ error: 'Speichern nicht möglich. Bitte erneut versuchen.' }, 503); }
}
