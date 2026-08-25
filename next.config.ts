import type { NextConfig } from "next";

/**
 * Lacalle Life is local-first: the browser's IndexedDB is the only source of
 * truth. The server renders the shell and nothing else — it never reads or
 * writes user data.
 *
 * Notes on what is deliberately *not* enabled:
 *
 * - `output: "export"` would forbid dynamic segments like `/dieta/[id]`,
 *   whose ids exist only in the visitor's browser and cannot be known at
 *   build time. Degrading those routes to query strings is not worth it.
 * - `cacheComponents` / `use cache` govern server data reuse. There is no
 *   server data to reuse.
 * - `experimental.useOffline` retries failed navigations and Server Actions.
 *   Offline support here means caching the app shell in a service worker,
 *   which is a separate concern handled by the PWA layer.
 */
const nextConfig: NextConfig = {
  reactStrictMode: true,

  // Automatic memoization. Removes the need to hand-write useMemo/useCallback,
  // which is the main source of stale-closure bugs in interactive UIs.
  reactCompiler: true,

  // Compile-time checking of every href against the real route tree.
  typedRoutes: true,

  poweredByHeader: false,

  /**
   * `/sw.js` keeps its own rule: a service worker updates only when the
   * browser fetches a *different* `sw.js`, so if an intermediary is allowed
   * to hold the old copy, the offline shell it installs becomes permanent —
   * every future deploy invisible to anyone who already visited. The caching
   * this file performs is deliberate; caching the file itself is a trap.
   *
   * Everything else here is baseline hardening applied to every response.
   * `Content-Security-Policy` is deliberately **not** here: it needs a fresh
   * nonce per request for the app's two inline scripts, which a static header
   * list cannot produce — see `src/middleware.ts`, which sets it instead.
   *
   * - `X-Frame-Options: DENY` — belt-and-suspenders alongside the CSP's own
   *   `frame-ancestors 'none'`, for the handful of older browsers that read
   *   the header but not the directive. This app never needs to be framed by
   *   anything, including itself.
   * - `X-Content-Type-Options: nosniff` — stops a browser from executing a
   *   response as script or HTML because it guessed a content type, rather
   *   than trusting the `Content-Type` this app actually sent.
   * - `Referrer-Policy: strict-origin-when-cross-origin` — this app has no
   *   ids or tokens in a URL to leak (data lives in IndexedDB, never in query
   *   strings), but a diet or routine id in the path is still nothing a
   *   destination site needs, so cross-origin navigation sends only the
   *   origin rather than the full path.
   * - `Permissions-Policy` — every browser API the app does not use, turned
   *   off for this origin and every one it could be framed by (moot given
   *   `frame-ancestors 'none'`, kept for defence in depth). Grepped for each
   *   before disabling it, not assumed: no camera, microphone, geolocation,
   *   payment UI, USB, display capture, or fullscreen call exists anywhere
   *   in `src/`.
   */
  async headers() {
    const globalHeaders = [
      { key: "X-Frame-Options", value: "DENY" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      {
        key: "Permissions-Policy",
        value: [
          "camera=()",
          "microphone=()",
          "geolocation=()",
          "payment=()",
          "usb=()",
          "display-capture=()",
          "fullscreen=()",
        ].join(", "),
      },
    ];

    return [
      { source: "/(.*)", headers: globalHeaders },
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },

  /**
   * Exercise photos are served from the source repository through
   * jsDelivr — never copied into this repo, never re-hosted.
   *
   * They are routed through Next's optimizer rather than linked directly
   * because the originals are 850x567 and we draw them at 64px wide. Straight
   * `<img>` tags would ship roughly two hundred times the pixels needed. The
   * optimizer also makes the URLs same-origin, which is what a service worker
   * will need to cache when offline support lands.
   */
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn.jsdelivr.net",
        pathname: "/gh/yuhonas/free-exercise-db@*/exercises/**",
      },
      {
        protocol: "https",
        hostname: "wger.de",
        pathname: "/media/exercise-images/**",
      },
    ],
  },
};

export default nextConfig;
