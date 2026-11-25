// 離線快取（只管相機頁）：有網路就拿新版並更新快取，沒網路或 3 秒沒回應就用快取。
// 分類頁和辨識模型不經過這裡。
const CACHE = 'wmcam-v1';
const FILES = ['./', 'index.html', 'manifest.json', 'icon.png'];
const urls = () => FILES.map(f => new URL(f, self.registration.scope).href);

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const u = new URL(req.url); u.search = ''; u.hash = '';
  if (!urls().includes(u.href)) return;
  const key = u.href;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const net = fetch(req, { cache: 'no-cache' }).then(async r => { if (r.ok) await cache.put(key, r.clone()); return r; });
    e.waitUntil(net.catch(() => { }));
    const timeout = new Promise(r => setTimeout(r, 3000));
    try {
      const r = await Promise.race([net, timeout]);
      if (r) return r;
    } catch (err) { }
    const hit = await cache.match(key);
    if (hit) { net.catch(() => { }); return hit; }
    return net;
  })());
});
