/* Okno Master Pro — service worker (офлайн-кэш и установка PWA) */
const VERSION = "v1";
const STATIC_CACHE = `okno-static-${VERSION}`;
const PAGE_CACHE = `okno-pages-${VERSION}`;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((c) => c.addAll(["/manifest.webmanifest", "/favicon.svg", "/icons/icon-192.png", "/icons/icon-512.png"]))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => ![STATIC_CACHE, PAGE_CACHE].includes(k)).map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Страницы: сначала сеть, при отсутствии интернета — последняя сохранённая версия.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(PAGE_CACHE).then((c) => c.put(req, copy));
            if (url.pathname !== "/") {
              // Запасной вариант для офлайна: клиентский роутер откроет нужный экран.
              caches.open(PAGE_CACHE).then((c) => c.put("/", res.clone()).catch(() => {}));
            }
          }
          return res;
        })
        .catch(() =>
          caches.match(req).then((hit) => hit || caches.match("/")).then(
            (hit) =>
              hit ||
              new Response("Нет подключения к интернету. Откройте приложение один раз онлайн.", {
                status: 503,
                headers: { "content-type": "text/plain; charset=utf-8" },
              }),
          ),
        ),
    );
    return;
  }

  // Статика (хешированные файлы, шрифты, иконки): из кэша, иначе из сети + сохранить.
  const sameOrigin = url.origin === self.location.origin;
  const isFont = url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com";
  if ((sameOrigin && !url.pathname.startsWith("/api/")) || isFont) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok || res.type === "opaque") {
              const copy = res.clone();
              caches.open(STATIC_CACHE).then((c) => c.put(req, copy));
            }
            return res;
          }),
      ),
    );
  }
});
