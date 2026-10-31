// CastawaySOL PWA Service Worker
const CACHE_NAME = 'castaway-sol-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // 网络优先，离线回退
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
