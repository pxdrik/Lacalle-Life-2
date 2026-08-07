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
    ],
  },
};

export default nextConfig;
