const CACHE_NAME = 'hbr-operacional-ia-v0.3.12';
const APP_SHELL = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  '/manifest.webmanifest',
  '/assets/hbr-logo-compact.png',
  '/assets/hbr-logo-mark.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.pathname.startsWith('/api/')) return;
  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request).then((response) => {
      if (response.ok && url.origin === location.origin) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
      }
      return response;
    }).catch(() => caches.match('/index.html')))
  );
});

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: 'HBR Operacional IA', body: event.data ? event.data.text() : '' };
  }
  const title = payload.title || 'HBR Operacional IA';
  const options = {
    body: payload.body || 'Existe uma atualizacao operacional para revisar.',
    icon: payload.icon || '/assets/hbr-logo-mark.png',
    badge: payload.badge || '/assets/hbr-logo-mark.png',
    tag: payload.tag || `hbr-${Date.now()}`,
    data: payload.data || { url: '/' },
    requireInteraction: Boolean(payload.requireInteraction),
    actions: [
      { action: 'open', title: 'Abrir app' },
      { action: 'dismiss', title: 'Depois' }
    ]
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('message', (event) => {
  const message = event.data || {};
  if (message.type !== 'HBR_SHOW_NOTIFICATION') return;
  event.waitUntil(self.registration.showNotification(message.title || 'HBR Operacional IA', {
    body: message.body || '',
    icon: '/assets/hbr-logo-mark.png',
    badge: '/assets/hbr-logo-mark.png',
    tag: message.tag || `local-${Date.now()}`,
    data: message.data || { url: '/' },
    requireInteraction: Boolean(message.requireInteraction)
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'dismiss') return;
  const targetUrl = new URL(event.notification.data?.url || '/', self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const current = clients.find((client) => client.url.startsWith(self.location.origin));
      if (current) {
        current.focus();
        current.postMessage({ type: 'HBR_NOTIFICATION_OPEN', url: targetUrl, data: event.notification.data || {} });
        return;
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});
