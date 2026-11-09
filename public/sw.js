// Service worker PARADOX: membuat website bisa di-install di HP, menampilkan halaman
// offline kalau internet putus, dan menampilkan notifikasi "talent sedang live".
// Sengaja TIDAK menyimpan (cache) isi website, supaya pengunjung selalu dapat versi terbaru.
const CACHE = 'paradox-offline-v1';
const OFFLINE_URL = '/offline.html';

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll([OFFLINE_URL, '/icons/icon-192.png'])));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Hanya menangani pembukaan halaman: coba internet dulu, kalau gagal tampilkan halaman offline
self.addEventListener('fetch', (event) => {
  if (event.request.mode !== 'navigate') return;
  event.respondWith(fetch(event.request).catch(() => caches.match(OFFLINE_URL)));
});

// Notifikasi push dari server (fungsi push-live)
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: 'PARADOX', body: event.data ? event.data.text() : '' };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'PARADOX', {
      body: data.body || '',
      icon: data.icon || '/icons/icon-192.png',
      badge: '/icons/favicon-32x32.png',
      image: data.image,
      tag: data.tag,
      renotify: Boolean(data.tag),
      data: { url: data.url || '/' }
    })
  );
});

// Notifikasi diketuk: buka (atau fokuskan) website ke ruang live talent
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if (new URL(w.url).origin === self.location.origin && 'navigate' in w) {
          return w.navigate(url).then((c) => c && c.focus());
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
