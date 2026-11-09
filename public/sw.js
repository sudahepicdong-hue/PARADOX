// Service worker PARADOX: membuat website bisa di-install di HP
// dan menampilkan halaman offline kalau internet putus.
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
