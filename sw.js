/* PDF Toolkit service worker. */
const CACHE = 'pdf-toolkit-v3';
const SHELL = ['./', './pdf-toolkit.html', './mobile-process.js', './ocr.js', './security.js', './blank-pages.js', './text-extract.js', './pdf-to-images.js', './figure-images.js',
  'https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.min.mjs',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs'];
const OCR = [
  'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js',
  'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/worker.min.js',
  'https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1/tesseract-core.wasm.js',
  'https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1/tesseract-core.wasm',
  'https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1/tesseract-core-simd.wasm.js',
  'https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1/tesseract-core-simd.wasm',
  'https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1/tesseract-core-lstm.wasm.js',
  'https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1/tesseract-core-lstm.wasm',
  'https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1/tesseract-core-simd-lstm.wasm.js',
  'https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1/tesseract-core-simd-lstm.wasm',
  'https://tessdata.projectnaptha.com/4.0.0/eng.traineddata.gz'
];
async function cacheOne(cache, url) {
  try {
    const absolute = new URL(url, self.location.href).href;
    const res = await fetch(absolute, {cache:'reload'});
    if (!res.ok || (res.type !== 'basic' && res.type !== 'cors')) throw new Error('HTTP ' + res.status);
    await cache.put(absolute, res.clone());
    return null;
  } catch (e) { return url + ' (' + (e?.message || 'failed') + ')'; }
}
async function cacheList(urls, client) {
  const cache = await caches.open(CACHE), failed = [];
  for (let i=0; i<urls.length; i++) {
    const err = await cacheOne(cache, urls[i]);
    if (err) failed.push(err);
    if (client) client.postMessage({type:'OCR_CACHE_PROGRESS', done:i+1, total:urls.length, current:urls[i].split('/').pop()});
  }
  return failed;
}
self.addEventListener('install', event => event.waitUntil((async () => {
  await caches.open(CACHE);
  await cacheList(SHELL);
  await self.skipWaiting();
})()));
self.addEventListener('activate', event => event.waitUntil((async () => {
  const keys = await caches.keys();
  await Promise.all(keys.filter(k => k.startsWith('pdf-toolkit-') && k !== CACHE).map(k => caches.delete(k)));
  await self.clients.claim();
})()));
self.addEventListener('message', event => {
  if (event.data?.type !== 'CACHE_OCR_ASSETS') return;
  event.waitUntil((async () => {
    const client = await self.clients.get(event.source?.id);
    const failed = await cacheList(OCR, client);
    // A successful download is not enough: verify that every required OCR and
    // app-shell URL is actually present in Cache Storage before reporting ready.
    const cache = await caches.open(CACHE);
    const required = [...SHELL, ...OCR];
    for (const url of required) {
      const absolute = new URL(url, self.location.href).href;
      if (!await cache.match(absolute) && !failed.some(item => item.startsWith(url + ' '))) {
        failed.push(url + ' (not present in cache after preparation)');
      }
    }
    client?.postMessage({type:'OCR_CACHE_DONE', failed, verified: failed.length === 0, checked: required.length});
  })());
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(event.request);
    if (hit) return hit;
    try {
      const res = await fetch(event.request);
      if (res.ok && (event.request.url.startsWith(self.location.origin) || /cdn.jsdelivr.net|cdnjs.cloudflare.com|tessdata.projectnaptha.com/.test(event.request.url))) {
        try { await cache.put(event.request, res.clone()); } catch (_) {}
      }
      return res;
    } catch (_) {
      if (event.request.mode === 'navigate') {
        const fallback = await cache.match('./pdf-toolkit.html') || await cache.match('./');
        if (fallback) return fallback;
      }
      return new Response('Offline: this resource has not been cached.', {status:503, headers:{'Content-Type':'text/plain; charset=utf-8'}});
    }
  })());
});