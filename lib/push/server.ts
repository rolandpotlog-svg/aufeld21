import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { randomBytes } from 'node:crypto';
import webpush from 'web-push';
import { pushEmails, pushPayload, validSubscription, type BrowserSubscription } from './validation';
export { validDispatch } from './signature';

export type PushConfig = { publicKey: string; privateKey: string; dispatchSecret: string };
export function pushDatabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error('Push server not configured');
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}
export async function authorizePush(request: Request) {
  const token = request.headers.get('authorization');
  if (!token?.startsWith('Bearer ')) return null;
  const db = pushDatabase();
  const { data: { user }, error } = await db.auth.getUser(token.slice(7));
  if (error || !user) return null;
  const [{ data: member }, { data: allowed }] = await Promise.all([
    db.from('members').select('id,email,role,active').eq('id', user.id).single(),
    db.from('push_recipients').select('email').eq('member_id', user.id).single(),
  ]);
  if (!member?.active || member.role !== 'admin' || !allowed || !pushEmails.has(member.email.toLowerCase())
    || member.email.toLowerCase() !== allowed.email || user.email?.toLowerCase() !== allowed.email) return null;
  return { db, memberId: member.id as string };
}
export async function getPushConfig(db: SupabaseClient, initialize = false): Promise<PushConfig | null> {
  const existing = await db.rpc('push_config');
  if (existing.error) throw new Error('Push configuration unavailable');
  if (existing.data || !initialize) return existing.data;
  const keys = webpush.generateVAPIDKeys();
  const created = await db.rpc('push_config', { candidate: { ...keys, dispatchSecret: randomBytes(32).toString('base64url') } });
  if (created.error || !created.data) throw new Error('Push initialization failed');
  return created.data;
}
export async function processPush(db: SupabaseClient, config: PushConfig) {
  const { data: jobs, error } = await db.rpc('push_claim');
  if (error) throw new Error('Push queue unavailable');
  type Job = { job_id: string; lease: string; subscription_id: string; subscription: BrowserSubscription; issue_id: string | null; is_test: boolean };
  let sent = 0;
  // At most ten deliveries, in pairs; library exceptions can contain endpoint
  // credentials and payload, so never log the raw exception.
  for (let offset = 0; offset < (jobs?.length ?? 0); offset += 2) {
    await Promise.all((jobs as Job[]).slice(offset, offset + 2).map(async job => {
      let outcome = 'failed';
      const { data: current } = await db.from('push_subscriptions').select('active,member_id').eq('id', job.subscription_id).single();
      const { data: member } = current ? await db.from('members').select('active,role,email').eq('id', current.member_id).single() : { data: null };
      const { data: allowed } = current ? await db.from('push_recipients').select('email').eq('member_id', current.member_id).single() : { data: null };
      if (current?.active && member?.active && member.role === 'admin' && allowed && allowed.email === member.email?.toLowerCase()
        && pushEmails.has(allowed.email) && validSubscription(job.subscription)) {
        try {
          await webpush.sendNotification(job.subscription, JSON.stringify(pushPayload(job.job_id, job.is_test)), {
            vapidDetails: { subject: 'mailto:roland@immo-kredit.net', publicKey: config.publicKey, privateKey: config.privateKey },
            TTL: 3600, urgency: 'normal', topic: job.job_id.replaceAll('-', ''), timeout: 5000,
          });
          outcome = 'sent'; sent++;
        } catch (error) {
          const status = (error as { statusCode?: number }).statusCode;
          outcome = status === 404 || status === 410 ? 'gone' : !status || status === 429 || status >= 500 ? 'retry' : 'failed';
        }
      }
      const result = await db.rpc('push_finish', { target_job: job.job_id, target_lease: job.lease, outcome });
      if (result.error) throw new Error('Push acknowledgement unavailable');
    }));
  }
  return { processed: jobs?.length ?? 0, sent };
}
