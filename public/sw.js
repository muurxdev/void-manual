/* Void — uso offline do app. Tela e código ficam guardados; o resto passa direto pela rede. */
const CACHE = 'void-v19';
const ROOT = self.registration.scope;
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll([ROOT, ROOT + 'favicon.svg', ROOT + 'icon-192.png'])).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin || url.pathname.endsWith('.wasm')) return;
  // páginas: rede primeiro, cai para o guardado sem internet
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req, { cache: 'no-cache' }) // sempre confere com o servidor (o cache do navegador dura 10 min)
        .then((r) => {
          const copy = r.clone();
          caches.open(CACHE).then((c) => c.put(ROOT, copy));
          return r;
        })
        .catch(() => caches.match(ROOT))
    );
    return;
  }
  // arquivos com hash no nome: guardados para sempre; demais: atualiza em segundo plano
  e.respondWith(
    caches.match(req).then((hit) => {
      const net = fetch(req)
        .then((r) => {
          if (r.ok) caches.open(CACHE).then((c) => c.put(req, r.clone()));
          return r;
        })
        .catch(() => hit);
      return hit || net;
    })
  );
});
