// Shchuna 360 service worker. Build: __BUILD__
// Pages come from the network (cache only as offline fallback); built assets,
// fonts and images come from the cache. Supabase calls are never cached.
const CACHE = "shchuna360-__BUILD__";

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(["/", "/icon.svg", "/ashdod-logo.png", "/manifest.webmanifest"])));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (e) => e.data === "skip" && self.skipWaiting());

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.hostname.endsWith("supabase.co")) return;

  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then((r) => {
          const copy = r.clone();
          caches.open(CACHE).then((c) => c.put("/", copy));
          return r;
        })
        .catch(() => caches.match("/")),
    );
    return;
  }

  const cacheable =
    url.pathname.startsWith("/assets/") ||
    /\.(png|svg|webp|jpg|woff2?)$/.test(url.pathname) ||
    url.hostname.includes("fonts.g") ||
    url.hostname === "appofapp-gh.vercel.app";
  if (!cacheable) return;
  e.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then((r) => {
          if (r.ok || r.type === "opaque") {
            const copy = r.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return r;
        }),
    ),
  );
});
