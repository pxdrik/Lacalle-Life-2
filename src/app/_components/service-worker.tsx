"use client";

import { useEffect } from "react";

/**
 * Registers the offline shell.
 *
 * Production only, and that is not caution — in development a service worker
 * serves yesterday's chunks against today's HTML, which produces hydration
 * errors that look like application bugs and take an afternoon to trace back
 * to the cache.
 *
 * Failure is swallowed on purpose. Registration fails on an insecure origin,
 * with the API disabled, or in a private window; none of those stop the app
 * from working, and an error nobody can act on is noise.
 */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    // After load: registration competes with the page's own chunks for
    // bandwidth, and the page is what somebody is waiting for.
    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Offline support is an enhancement; the app is already local-first.
      });
    };

    if (document.readyState === "complete") {
      register();
      return;
    }

    window.addEventListener("load", register);
    return () => {
      window.removeEventListener("load", register);
    };
  }, []);

  return null;
}
