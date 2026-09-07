import { getPushConfig, processPush, pushDatabase, validDispatch } from '@/lib/push/server';

export const maxDuration = 60;
export async function POST(request: Request) {
  const signature = request.headers.get('x-push-signature');
  if (!signature || !/^[a-f0-9]{64}$/.test(signature)) return new Response(null, { status: 401 });
  if (Number(request.headers.get('content-length') ?? 0) > 512) return new Response(null, { status: 413 });
  try {
    const raw = await request.text();
    if (raw.length > 512) return new Response(null, { status: 413 });
    const { timestamp } = JSON.parse(raw);
    if (typeof timestamp !== 'string' || Math.abs(Date.now() / 1000 - Number(timestamp)) > 90) return new Response(null, { status: 401 });
    const db = pushDatabase();
    const config = await getPushConfig(db);
    if (!config || !validDispatch(timestamp, signature, config.dispatchSecret)) return new Response(null, { status: 401 });
    return Response.json(await processPush(db, config), { headers: { 'Cache-Control': 'no-store' } });
  } catch { return Response.json({ error: 'Push-Verarbeitung fehlgeschlagen.' }, { status: 503 }); }
}
