export const pushEmails = new Set(['julia.potlog@gmail.com', 'roland.potlog@gmail.com']);
export type BrowserSubscription = { endpoint: string; keys: { auth: string; p256dh: string } };

// Never accept arbitrary callback URLs: the server sends only to known browser
// push providers, not to private addresses or user-controlled HTTP endpoints.
export function validSubscription(value: unknown): value is BrowserSubscription {
  if (!value || typeof value !== 'object') return false;
  const sub = value as Partial<BrowserSubscription>;
  if (typeof sub.endpoint !== 'string' || sub.endpoint.length >= 2048) return false;
  try {
    const url = new URL(sub.endpoint);
    const host = url.hostname.toLowerCase();
    const allowed = host === 'fcm.googleapis.com' || host === 'web.push.apple.com'
      || host === 'updates.push.services.mozilla.com' || host.endsWith('.notify.windows.com');
    if (!allowed || url.protocol !== 'https:' || url.port || url.username || url.password || url.hash) return false;
  } catch { return false; }
  return typeof sub.keys?.p256dh === 'string' && /^[A-Za-z0-9_-]{87}$/.test(sub.keys.p256dh)
    && typeof sub.keys?.auth === 'string' && /^[A-Za-z0-9_-]{22}$/.test(sub.keys.auth);
}

export function pushPayload(id: string, isTest: boolean) {
  return { id, title: 'AUFELD21', body: isTest ? 'Testnachricht: Handy-Push ist verbunden.' : 'Neue Meldung im Portal. Bitte im Adminbereich ansehen.', url: '/portal?view=issues' };
}
