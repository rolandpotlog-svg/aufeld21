import { createHmac, timingSafeEqual } from 'node:crypto';

export function validDispatch(timestamp: unknown, signature: string | null, secret: string, now = Date.now()) {
  if (typeof timestamp !== 'string' || !/^\d{10}$/.test(timestamp) || !signature || !/^[a-f0-9]{64}$/.test(signature)) return false;
  if (Math.abs(now / 1000 - Number(timestamp)) > 90) return false;
  return timingSafeEqual(Buffer.from(signature, 'hex'), createHmac('sha256', secret).update(timestamp).digest());
}
