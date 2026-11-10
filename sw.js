// HomeBudget service worker: network first (so new versions arrive as soon as you're online), cached copy when offline.
const CACHE = 'homebudget-shell-5';
const SHELL = ['./', 'index.html', 'manifest.webmanifest', 'icon4-192.png', 'icon4-512.png', 'icon4-maskable-512.png', 'apple-touch-icon4.png'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(self.clients.claim());
});
self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const u = new URL(r.url);
  if (u.origin !== location.origin) return; // bank requests etc. go straight to the network
  e.respondWith(
    fetch(r).then(res => {
      if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(r, copy)); }
      return res;
    }).catch(() => caches.match(r).then(m => m || caches.match('index.html')))
  );
});
