// CastawaySOL PWA Service Worker (v2 - 强制清理旧版本缓存)
const CACHE_NAME = 'castaway-sol-v2';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // 网络优先，杜绝加载过期JS
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
