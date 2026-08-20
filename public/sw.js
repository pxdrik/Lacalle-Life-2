/**
 * Offline shell for Lacalle Life.
 *
 * The data was never the problem: diets, workouts, weigh-ins and the food log
 * all live in IndexedDB and have always worked without a network. What did not
 * work was *opening the app* — which made a local-first product depend on a
 * signal exactly where it is used, in a gym, usually a floor below ground.
 *
 * So this caches the shell and nothing else. It never touches IndexedDB, never
 * caches a response containing user data, and has no sync logic: there is no
 * server holding anything of yours to sync with.
 *
 * Written by hand rather than generated. A build plugin would bring a
 * precache manifest of every hashed chunk, which is precise and also means
 * nobody can read what the cache does. Three rules that fit on a screen are
 * worth more here than exhaustiveness.
 */

// Bump to retire every previous cache. Old entries are deleted on activate, so
// a stale shell cannot outlive a deploy.
const VERSION = "v4";
const SHELL = `lacalle-shell-${VERSION}`;
const ASSETS = `lacalle-assets-${VERSION}`;
const PAYLOADS = `lacalle-payloads-${VERSION}`;

/**
 * Cap on RSC payload entries, evicted oldest-first once exceeded.
 *
 * Every client-side navigation to a route with a fresh id (`_rsc=<hash>`)
 * mints a new cacheable URL, so this cache grows by construction, not just
 * by a missing cleanup routine — measured on a real session at 144 of 160
 * total cache entries. Ten routes' worth is enough to keep the diets,
 * routines and sessions someone actually opened recently working offline,
 * without the cache becoming the largest thing in storage on a phone that
 * has been left running for a week.
 */
const MAX_PAYLOAD_ENTRIES = 40;

/**
 * The routes worth having before they are first visited.
 *
 * Only static ones. `/dietas/[id]` and `/sessao/[id]` cannot be listed: their
 * ids exist solely in this browser, so there is no build-time list of them.
 * They are reached instead through `isPayload` below — opening one while
 * online caches the payload the client router needs to open it again offline.
 */
const ROUTES = [
  "/",
  "/diario",
  "/treinos",
  "/dietas",
  "/evolucao",
  "/exercicios",
  "/alimentos",
  "/perfil",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL).then(async (cache) => {
      // `Promise.allSettled`, not `addAll`: `addAll` rejects the whole install
      // if a single request fails, which would leave the visitor with no
      // service worker at all because one route happened to 500.
      await Promise.allSettled(ROUTES.map((route) => cache.add(route)));
      await self.skipWaiting();
    }),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key !== SHELL && key !== ASSETS && key !== PAYLOADS)
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only GET, and only our own origin. A POST is never replayable from a
  // cache, and another origin's responses are not ours to keep.
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, SHELL));
    return;
  }

  if (isPayload(url)) {
    event.respondWith(networkFirst(request, PAYLOADS));
    return;
  }

  if (isImmutable(url)) {
    event.respondWith(cacheFirst(request));
  }
});

/**
 * What the client router fetches when moving between routes without a page
 * load — Next calls it the RSC payload.
 *
 * This is what makes `/dietas/<id>` work offline, and leaving it out is what
 * made the first version wrong. Without the payload the router cannot render
 * the route, so it falls back to a full navigation; that navigation misses the
 * cache, lands on the shell, and the person sees the home screen while the
 * address bar says they opened a diet. Caching the payload means a diet opened
 * once online opens again with no signal at all.
 */
function isPayload(url) {
  return url.searchParams.has("_rsc");
}

/**
 * Everything Next fingerprints with a content hash, plus the two icons.
 *
 * A hashed URL can never point at different bytes, so serving it from cache
 * without asking is correct rather than merely fast. `/_next/image` carries
 * its parameters in the query string, which makes each variant its own
 * immutable URL — that is what caches the exercise photos.
 */
function isImmutable(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/_next/image") ||
    url.pathname === "/icon.svg" ||
    url.pathname === "/icon-maskable.svg"
  );
}

/**
 * The network wins when it answers, so a deploy is picked up on the next
 * navigation rather than whenever the cache happens to expire.
 *
 * Falling back to the exact page first and to `/` second: an unvisited route
 * offline is better served by the app's own home screen — which reads real
 * data from IndexedDB — than by a dead-end error page.
 *
 * **`response.ok` gates the write.** A route that answered once with a 404 or
 * a 500 used to get cached anyway, and the next offline visit replayed that
 * same error forever — the fix a deploy shipped could never reach a cache
 * that already held the failure. `cacheFirst` below already had this check;
 * this only had to catch up.
 */
async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);

    if (response.ok) {
      const cache = await caches.open(cacheName);
      await cache.put(request, response.clone());
      if (cacheName === PAYLOADS) await prunePayloadCache();
    }

    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached !== undefined) return cached;

    const shell = await caches.match("/");
    if (shell !== undefined) return shell;

    throw new Error("offline e sem shell em cache");
  }
}

/**
 * Evicts the oldest payload entries once the cache exceeds
 * `MAX_PAYLOAD_ENTRIES`, oldest first.
 *
 * `Cache.keys()` returns entries in insertion order in every engine that
 * implements the Cache API today, which is what makes "oldest" mean anything
 * here — there is no timestamp stored per entry, and adding one would cost a
 * second store just to sort a list a `Cache` already hands back sorted.
 */
async function prunePayloadCache() {
  const cache = await caches.open(PAYLOADS);
  const keys = await cache.keys();
  const excess = keys.length - MAX_PAYLOAD_ENTRIES;
  if (excess <= 0) return;

  await Promise.all(keys.slice(0, excess).map((key) => cache.delete(key)));
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached !== undefined) return cached;

  const response = await fetch(request);

  // Opaque and error responses are not worth keeping: a cached 404 outlives
  // the deploy that fixes it.
  if (response.ok) {
    const cache = await caches.open(ASSETS);
    cache.put(request, response.clone());
  }

  return response;
}
