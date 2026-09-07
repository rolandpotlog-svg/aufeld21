import { createHmac } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { contactInput, smallJson } from '@/lib/contacts/input';
import { meetingJson as json } from '@/lib/members/meeting-api';

export async function POST(request: Request) {
  const origin = request.headers.get('origin');
  const allowed = ['https://www.aufeld21.at', 'https://aufeld21.at', 'https://aufeld21.vercel.app'];
  if (process.env.NODE_ENV === 'development') allowed.push(new URL(request.url).origin);
  if (process.env.VERCEL_URL) allowed.push(`https://${process.env.VERCEL_URL}`);
  if (!origin || !allowed.includes(origin)) return json({ error: 'Bitte das Formular auf unserer Website verwenden.' }, 403);
  let data;
  try {
    const raw = await smallJson(request);
    if (raw && typeof raw === 'object' && 'website' in raw && raw.website) return json({ ok: true });
    data = contactInput(raw);
  } catch (error) { return json({ error: error instanceof Error ? error.message : 'Bitte Eingaben prüfen.' }, 400); }
  const key = process.env.SUPABASE_SECRET_KEY, url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!key || !url) return json({ error: 'Anfragen sind gerade nicht verfügbar. Bitte per E-Mail kontaktieren.' }, 503);
  // Vercel overwrites x-forwarded-for at its edge. Do not trust this header on other hosts.
  const ip = process.env.VERCEL === '1' ? request.headers.get('x-forwarded-for')?.split(',')[0].trim() : process.env.NODE_ENV === 'development' ? 'local-development' : null;
  if (!ip) return json({ error: 'Anfrage konnte nicht geprüft werden. Bitte per E-Mail kontaktieren.' }, 503);
  const hash = (purpose: string, value: string) => createHmac('sha256', key).update(`aufeld21-contact:${purpose}:${value}`).digest('hex');
  try {
    const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { error } = await db.rpc('submit_contact_request', { p_id: data.id, p_name: data.name, p_email: data.email, p_phone: data.phone, p_offer: data.offer, p_message: data.message, p_ip_hash: hash('ip', ip), p_email_hash: hash('email', data.email) });
    if (error?.message.includes('CONTACT_RATE_LIMIT')) return json({ error: 'Zu viele Anfragen. Bitte später erneut versuchen oder direkt Kontakt aufnehmen.' }, 429);
    if (error) throw error;
    return json({ ok: true });
  } catch { return json({ error: 'Deine Anfrage konnte nicht bestätigt werden. Bitte erneut versuchen oder uns per E-Mail kontaktieren.' }, 503); }
}
