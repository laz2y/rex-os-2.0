/* REX OS 3.0 service worker
 * Conservative caching:
 *  - navigations: network first, fall back to the cached shell when offline
 *  - same-origin static assets: stale-while-revalidate
 *  - API requests are NEVER cached (session-authenticated data)
 * Registered only in production builds (see src/main.jsx).
 *
 * Update flow: on install we skipWaiting so a new service worker activates
 * immediately; the app listens for controllerchange and reloads once so a
 * new deploy is picked up as soon as it is available.
 */
const CACHE = "rex-os-v3";
const PRECACHE = [
  "/",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/maskable-512.png",
  "/icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE && key.startsWith("rex-os-"))
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Never touch API calls — they carry the session cookie and contain
  // sensitive NAS state.
  if (url.pathname.startsWith("/api/")) return;
  if (url.origin !== location.origin) return;

  // App shell / navigations: network first, offline shell fallback.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() =>
          caches.match(request).then((hit) => hit || caches.match("/")),
        ),
    );
    return;
  }

  // Static assets: serve cache first, refresh in the background.
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    }),
  );
});
