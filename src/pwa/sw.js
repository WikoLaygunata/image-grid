const CACHE_NAME = 'image-grid-pwa-v1';
const CACHE_PREFIX = 'image-grid-pwa-';
const PRECACHE_ASSETS = __PRECACHE_ASSETS__;
const APP_SHELL = [
  '/',
  '/manifest.webmanifest',
  '/favicon.ico',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/Plus_Jakarta_Sans/PlusJakartaSans-VariableFont_wght.ttf',
];
const STATIC_ASSET_PATTERN = /\.(?:js|css|woff2?|ttf|otf|svg|png|ico|webp)$/i;

self.addEventListener('install', (event) => {
  event.waitUntil(
    Promise.all([
      caches.open(CACHE_NAME).then((cache) => cache.addAll([...APP_SHELL, ...PRECACHE_ASSETS])),
      self.skipWaiting(),
    ]),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      ),
      self.clients.claim(),
    ]),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request);
          if (response.ok) {
            try {
              const cache = await caches.open(CACHE_NAME);
              await cache.put('/', response.clone());
            } catch (error) {
              console.warn('Could not cache the app shell:', error);
            }
          }
          return response;
        } catch (error) {
          const cachedApp = await caches.match('/');
          if (cachedApp) return cachedApp;
          throw error;
        }
      })(),
    );
    return;
  }

  if (!STATIC_ASSET_PATTERN.test(url.pathname)) return;

  event.respondWith(
    (async () => {
      try {
        const response = await fetch(request);
        if (response.ok && response.type === 'basic') {
          try {
            const cache = await caches.open(CACHE_NAME);
            await cache.put(request, response.clone());
          } catch (error) {
            console.warn('Could not cache a static asset:', error);
          }
        }
        return response;
      } catch (error) {
        const cached = await caches.match(request);
        if (cached) return cached;
        throw error;
      }
    })(),
  );
});
