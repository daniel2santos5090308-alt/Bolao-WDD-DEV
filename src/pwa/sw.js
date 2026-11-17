/*
 * Service worker do Bolao WDD (Fase 8). O build (vite.config.js) troca o
 * marcador de BUILD_ID pelo identificador do deploy e publica como /sw.js.
 *
 * - Abre rapido e sem internet: a pagina vem da rede quando possivel e, sem
 *   rede, da ultima copia; /assets e /icons (nomes com hash) vem do cache.
 * - NUNCA guarda dados: Supabase, fontes e CDNs (outras origens) vao direto
 *   para a rede, assim como runtime-config.js e version.json.
 * - Cada deploy tem seu cache; o anterior e apagado na ativacao.
 */
const BUILD_ID = '__BUILD_ID__';
const CACHE = `bolao-wdd-${BUILD_ID}`;
const SHELL = ['/', '/manifest.webmanifest', '/icons/icon-192.png'];
const NETWORK_ONLY = new Set(['/version.json', '/sw.js', '/assets/js/runtime-config.js']);

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(SHELL.map((url) => new Request(url, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith('bolao-wdd-') && key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

async function networkFirstPage(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) await cache.put('/', response.clone());
    return response;
  } catch {
    return (await cache.match('/')) || Response.error();
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) await cache.put(request, response.clone());
  return response;
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (NETWORK_ONLY.has(url.pathname)) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstPage(request));
    return;
  }
  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(cacheFirst(request));
  }
});
