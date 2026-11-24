// Service worker của Avenor: chỉ dùng để hiện thông báo đẩy (đơn tranh mới...) và mở app khi bấm vào.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (e) => {
  let m = {};
  try { m = e.data ? e.data.json() : {}; } catch { m = { title: 'Avenor', body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(m.title || 'Avenor', {
    body: m.body || '',
    tag: m.tag || undefined,
    renotify: !!m.tag,
    requireInteraction: true,
    data: { url: m.url || '/#notifications' },
  }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = new URL(e.notification.data?.url || '/#notifications', self.location.origin).href;
  e.waitUntil((async () => {
    const list = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of list) {
      if (new URL(c.url).origin === self.location.origin) { await c.focus(); c.postMessage({ type: 'avenor:notifications' }); return; }
    }
    await self.clients.openWindow(url);
  })());
});
