// 離線快取（只管相機頁）：有網路就拿新版並更新快取，沒網路或 3 秒沒回應就用快取。
// 分類頁和辨識模型不經過這裡。
const CACHE = 'wmcam-v2';
const FILES = ['./', 'index.html', 'manifest.json', 'icon.png'];
const abs = f => new URL(f, self.registration.scope).href;

// Safari 不接受由 service worker 回傳「經過轉址」的頁面，所以轉址過的回應不存
const store = (cache, key, r) => (r && r.ok && !r.redirected) ? cache.put(key, r) : Promise.resolve();

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(FILES.map(f =>
    fetch(abs(f), { cache: 'reload' }).then(r => store(c, abs(f), r))))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const u = new URL(req.url); u.search = ''; u.hash = '';
  const key = u.href;
  if (!FILES.map(abs).includes(key)) return;
  // 同步建立網路請求並登記 waitUntil（Safari 對非同步登記較嚴格）
  const net = fetch(key, { cache: 'no-cache' }).then(r => { const c = r.clone(); caches.open(CACHE).then(ca => store(ca, key, c)); return r; });
  e.waitUntil(net.then(() => { }, () => { }));
  const fromCache = () => caches.match(key).then(h => h || caches.match(abs('index.html')));
  e.respondWith(
    Promise.race([net.then(r => r.ok ? r : null), new Promise(r => setTimeout(() => r(null), 3000))])
      .catch(() => null)
      .then(r => r || fromCache().then(h => h || net))
  );
});
