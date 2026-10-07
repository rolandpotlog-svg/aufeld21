import { createClient } from '@supabase/supabase-js';
import { validDispatch } from '@/lib/push/signature';
import { prepareAccounting } from '@/lib/notifications/accounting';

export const maxDuration = 60;
export async function POST(request: Request) {
  const signature = request.headers.get('x-accounting-signature');
  if (!signature || !/^[a-f0-9]{64}$/.test(signature)) return new Response(null, { status: 401 });
  if (Number(request.headers.get('content-length') ?? 0) > 512) return new Response(null, { status: 413 });
  try {
    // Stream limit prevents an unauthenticated caller buffering an oversized body.
    const reader = request.body?.getReader();
    if (!reader) return new Response(null, { status: 400 });
    const chunks: Uint8Array[] = [];
    let length = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > 512) { await reader.cancel(); return new Response(null, { status: 413 }); }
      chunks.push(value);
    }
    const { timestamp } = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (typeof timestamp !== 'string' || !/^\d{10}$/.test(timestamp)
      || Math.abs(Date.now() / 1000 - Number(timestamp)) > 90) return new Response(null, { status: 401 });
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SECRET_KEY;
    if (!url || !key) return new Response(null, { status: 503 });
    const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: secret, error } = await db.rpc('accounting_dispatch_secret');
    if (error || typeof secret !== 'string' || !secret || !validDispatch(timestamp, signature, secret)) {
      return new Response(null, { status: 401 });
    }
    return Response.json(await prepareAccounting(db), { headers: { 'Cache-Control': 'no-store' } });
  } catch { return Response.json({ error: 'Buchhaltungskopien konnten nicht vorbereitet werden.' }, { status: 503 }); }
}
