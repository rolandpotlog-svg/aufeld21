import { createClient } from '@supabase/supabase-js';
export async function meetingAuth(request: Request, adminOnly = false) {
  const token = request.headers.get('authorization');
  if (!token?.startsWith('Bearer ')) return null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error('Server configuration missing');
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: { user }, error } = await db.auth.getUser(token.slice(7));
  if (error || !user) return null;
  const { data: member } = await db.from('members').select('id,role,active').eq('id', user.id).single();
  if (!member?.active || (adminOnly && member.role !== 'admin')) return null;
  return { db, member };
}
export const meetingJson = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
