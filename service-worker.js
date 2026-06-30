/* Service Worker – Offline-Unterstützung für die Speisekarte */
const CACHE = "speisekarte-v3";

const APP_SHELL = [
  "./",
  "./index.html",
  "./qr.html",
  "./css/style.css",
  "./js/app.js",
  "./js/supabase-config.js",
  "./js/supabase-client.js",
  "./data/menu.json",
  "./manifest.webmanifest",
  "./icons/favicon.svg",
  "./icons/icon.svg",
  "./icons/icon-maskable.svg",
  "./images/logo.jpeg",
  "./images/hero.jpeg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Always try network first for the menu data so price/name edits show up,
  // fall back to cache when offline.
  if (url.pathname.endsWith("data/menu.json")) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // Cache-first for everything else (app shell, images, fonts)
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((res) => {
          if (res && res.status === 200 && (url.origin === location.origin)) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
    })
  );
});
