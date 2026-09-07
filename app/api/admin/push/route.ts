import { authorizePush, getPushConfig } from '@/lib/push/server';
import { validSubscription } from '@/lib/push/validation';

export const dynamic = 'force-dynamic';
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

export async function GET(request: Request) {
  try {
    const auth = await authorizePush(request);
    if (!auth) return json({ error: 'Push ist nur für Julia und Roland freigeschaltet.' }, 403);
    const config = await getPushConfig(auth.db, true);
    const { data, error } = await auth.db.from('push_subscriptions').select('endpoint,last_success_at').eq('member_id', auth.memberId).eq('active', true);
    if (error) throw error;
    return json({ publicKey: config!.publicKey, devices: data });
  } catch { return json({ error: 'Die Push-Einstellungen sind gerade nicht erreichbar.' }, 503); }
}

export async function POST(request: Request) {
  try {
    const auth = await authorizePush(request);
    if (!auth) return json({ error: 'Push ist nur für Julia und Roland freigeschaltet.' }, 403);
    if (Number(request.headers.get('content-length') ?? 0) > 8192) return json({ error: 'Anfrage zu groß.' }, 413);
    const raw = await request.text();
    if (raw.length > 8192) return json({ error: 'Anfrage zu groß.' }, 413);
    const body = JSON.parse(raw);
    if (body.action === 'subscribe') {
      if (!validSubscription(body.subscription)) return json({ error: 'Ungültige Gerätefreigabe.' }, 400);
      const sub = body.subscription;
      const { error } = await auth.db.rpc('push_register', { target_member: auth.memberId, sub: { endpoint: sub.endpoint, keys: sub.keys } });
      if (error) return json({ error: 'Gerät konnte nicht verbunden werden. Eventuell ist es bereits einem anderen Konto zugeordnet oder das Gerätelimit erreicht.' }, 409);
      return json({ ok: true });
    }
    if (typeof body.endpoint !== 'string' || body.endpoint.length >= 2048) return json({ error: 'Gerät fehlt.' }, 400);
    if (body.action === 'unsubscribe') {
      const { error } = await auth.db.from('push_subscriptions').delete().eq('member_id', auth.memberId).eq('endpoint', body.endpoint);
      if (error) throw error;
      return json({ ok: true });
    }
    if (body.action === 'test') {
      const { data, error } = await auth.db.rpc('push_test', { target_member: auth.memberId, target_endpoint: body.endpoint });
      if (error) throw error;
      if (!data) return json({ error: 'Gerät ist nicht verbunden oder der letzte Test ist weniger als eine Minute her.' }, 429);
      return json({ ok: true, message: 'Test vorgemerkt. Er sollte innerhalb von etwa einer Minute erscheinen.' });
    }
    return json({ error: 'Unbekannte Aktion.' }, 400);
  } catch { return json({ error: 'Push konnte gerade nicht gespeichert werden.' }, 503); }
}
