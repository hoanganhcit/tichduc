// Service worker: cache tĩnh để dùng offline. Đổi VERSION khi cập nhật file.
const VERSION = 'tichduc-v10';
const ASSETS = ['./', 'index.html', 'styles.css', 'game.js', 'chua.html', 'chua.js', 'avatar.js', 'bg-chinh-dien.png', 'icon.svg', 'manifest.json'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Mạng trước, lỗi mạng thì lấy cache (luôn có bản mới khi online, vẫn chạy khi offline)
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).pathname.startsWith('/api/')) return;   // API luôn đi thẳng mạng
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok && new URL(e.request.url).origin === location.origin) {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
