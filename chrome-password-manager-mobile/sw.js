// Service worker: pozwala otworzyć aplikację bez internetu (powłoka + kod).
// Dane sejfu są trzymane w localStorage (zaszyfrowane), nie tutaj.

const CACHE = "sejf-hasel-v1";
const SHELL = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./manifest.webmanifest",
  "./icons/icon192.png",
  "./icons/icon512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  // Tylko własne pliki aplikacji — zapytania do Google zawsze idą do sieci.
  if (url.origin !== location.origin) return;
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
