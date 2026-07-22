// Service worker: pozwala otworzyć aplikację bez internetu (powłoka + kod).
// Dane sejfu są trzymane w localStorage (zaszyfrowane), nie tutaj.
//
// Strategia "network-first" dla własnych plików: gdy jest internet, zawsze
// pobieramy najświeższą wersję (dzięki temu aktualizacje wchodzą same),
// a z pamięci podręcznej korzystamy tylko offline.

const CACHE = "sejf-hasel-v2";
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
  // Zapytania do Google zawsze idą do sieci — nie dotykamy ich.
  if (url.origin !== location.origin) return;
  event.respondWith(
    fetch(event.request)
      .then((resp) => {
        const copy = resp.clone();
        caches.open(CACHE).then((cache) => cache.put(event.request, copy)).catch(() => {});
        return resp;
      })
      .catch(() => caches.match(event.request))
  );
});
