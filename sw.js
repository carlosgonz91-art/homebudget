// HomeBudget service worker: network first (so new versions arrive as soon as you're online), cached copy when offline.
const CACHE = 'homebudget-shell-94';
const SHELL = ['./', 'index.html', 'manifest.webmanifest?v=7', 'icon7-192.png', 'icon7-512.png', 'icon7-maskable-512.png', 'apple-touch-icon7.png'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
// When a new version takes over, delete the copies saved by older versions, then start serving the open pages.
// Before, every update left its old copy behind, so the saved space kept growing. Only caches whose name starts
// with 'homebudget-shell-' are removed, and the current one is kept, so working offline behaves the same as before.
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith('homebudget-shell-') && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const u = new URL(r.url);
  if (u.origin !== location.origin) return; // bank requests etc. go straight to the network
  e.respondWith(
    fetch(r, { cache: 'no-cache' }).then(res => {
      if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(r, copy)); }
      return res;
    }).catch(() => caches.match(r, { ignoreSearch: true }).then(m => m || caches.match('index.html')))
  );
});
