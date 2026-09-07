/* Push only. No fetch handler and no caching of portal pages, tokens or PDFs. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

let delivery = Promise.resolve();
self.addEventListener('push', event => {
  delivery = delivery.catch(() => {}).then(async () => {
    let data;
    try { data = event.data?.json(); } catch { return; }
    if (!data || !/^[a-f0-9-]{36}$/.test(data.id)) return;
    let cache;
    const marker = new Request(new URL('/__push_notice/' + data.id, self.location.origin));
    try {
      cache = await caches.open('a21-push-dedupe-v1');
      if (await cache.match(marker)) return;
    } catch { /* Notification must still work when local storage is unavailable. */ }
    await self.registration.showNotification('AUFELD21', {
      body: typeof data.body === 'string' ? data.body.slice(0, 160) : 'Neue Meldung im Portal.',
      icon: '/icon-192.png', badge: '/icon-192.png', tag: 'a21-' + data.id,
      data: { url: '/portal?view=issues' },
    });
    if (cache) {
      await cache.put(marker, new Response('seen'));
      const keys = await cache.keys();
      await Promise.all(keys.slice(0, Math.max(0, keys.length - 100)).map(key => cache.delete(key)));
    }
  });
  event.waitUntil(delivery);
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil((async () => {
    const target = new URL('/portal?view=issues', self.location.origin).href;
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of windows) {
      const url = new URL(client.url);
      if (url.origin === self.location.origin && url.pathname === '/portal') {
        await client.navigate(target); return client.focus();
      }
    }
    return self.clients.openWindow(target);
  })());
});
