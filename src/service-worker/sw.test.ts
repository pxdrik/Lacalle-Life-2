import { describe, expect, it, vi } from "vitest";

import {
  fakeResponse,
  loadServiceWorker,
  type FakeRequest,
  type FakeResponse,
} from "./load-sw";

/**
 * Runs `public/sw.js` itself — see `load-sw.ts` for why. Two fixes from the
 * roadmap's Iniciativa F, both found by reading the file rather than by
 * reproducing a failure: `networkFirst` never checked `response.ok` before
 * caching, and the RSC payload cache had no eviction at all.
 *
 * Not covered here, and not claimed to be: the two scenarios that need a real
 * browser — offline on a physical device, and a service-worker update while
 * the app is open. Those stay on the roadmap as the residual risk this sprint
 * did not close.
 */

const navigate = (url: string): FakeRequest => ({
  url,
  method: "GET",
  mode: "navigate",
});

const payload = (n: number): FakeRequest => ({
  url: `https://lacalle.example/dietas/${String(n)}?_rsc=abc123`,
  method: "GET",
  mode: "no-cors",
});

describe("networkFirst never caches a failing response", () => {
  it("returns the error without writing it to the shell cache", async () => {
    const fetchImpl = vi.fn(
      async (): Promise<FakeResponse> => fakeResponse(500),
    );
    const sw = loadServiceWorker(fetchImpl);

    const result = (await sw.dispatchFetch(
      navigate("https://lacalle.example/dietas"),
    )) as FakeResponse;

    expect(result.status).toBe(500);

    const shell = sw.caches.peek("lacalle-shell-v1");
    expect(shell?.size ?? 0).toBe(0);
  });

  it("falls back to the shell offline, rather than replaying a stale error", async () => {
    let failNext = false;
    const fetchImpl = vi.fn(async (request: FakeRequest) => {
      if (failNext) throw new Error("offline");
      // The shell itself, cached first so the offline fallback has
      // somewhere to land.
      return fakeResponse(request.url.endsWith("/dietas") ? 500 : 200);
    });
    const sw = loadServiceWorker(fetchImpl);

    // Warms the shell fallback ("/").
    await sw.dispatchFetch(navigate("https://lacalle.example/"));

    // First visit to /dietas fails with a 500 — not cached, per the test above.
    await sw.dispatchFetch(navigate("https://lacalle.example/dietas"));

    // Now genuinely offline.
    failNext = true;
    const offlineResult = (await sw.dispatchFetch(
      navigate("https://lacalle.example/dietas"),
    )) as FakeResponse;

    // Not the 500 replayed from a cache — the shell, because nothing for
    // /dietas was ever actually cached.
    expect(offlineResult.status).toBe(200);
  });
});

describe("the RSC payload cache has a ceiling", () => {
  async function findPayloadCacheName(sw: ReturnType<typeof loadServiceWorker>) {
    const names = await sw.caches.keys();
    const name = names.find((n) => n.includes("payload"));
    if (name === undefined) throw new Error("payload cache was never opened");
    return name;
  }

  it("never grows past MAX_PAYLOAD_ENTRIES", async () => {
    const fetchImpl = vi.fn(async () => fakeResponse(200));
    const sw = loadServiceWorker(fetchImpl);

    for (let i = 0; i < 55; i += 1) {
      await sw.dispatchFetch(payload(i));
    }

    const name = await findPayloadCacheName(sw);
    const cache = sw.caches.peek(name);
    expect(cache?.size).toBe(40);
  });

  it("evicts the oldest entries first, keeping the most recently opened routes", async () => {
    const fetchImpl = vi.fn(async () => fakeResponse(200));
    const sw = loadServiceWorker(fetchImpl);

    for (let i = 0; i < 45; i += 1) {
      await sw.dispatchFetch(payload(i));
    }

    const name = await findPayloadCacheName(sw);
    const cache = sw.caches.peek(name);

    expect(cache?.match(payload(0).url)).toBeUndefined();
    expect(cache?.match(payload(44).url)).toBeDefined();
  });

  it("does not cache a failed payload fetch either", async () => {
    const fetchImpl = vi.fn(async () => fakeResponse(404));
    const sw = loadServiceWorker(fetchImpl);

    await sw.dispatchFetch(payload(1));

    // A failed fetch never even opens the payload cache — `networkFirst`
    // only calls `caches.open` inside its `response.ok` branch.
    const names = await sw.caches.keys();
    const name = names.find((n) => n.includes("payload"));
    const cache = name === undefined ? undefined : sw.caches.peek(name);
    expect(cache?.size ?? 0).toBe(0);
  });
});

describe("activate", () => {
  it("retires an old version's caches but keeps the current shell, assets and payload caches", async () => {
    const fetchImpl = vi.fn(async () => fakeResponse(200));
    const sw = loadServiceWorker(fetchImpl);

    // Opens the current-version caches for real, plus a stale one from a
    // version this deploy retires.
    await sw.dispatchFetch(navigate("https://lacalle.example/"));
    await sw.dispatchFetch(payload(1));
    await sw.caches.open("lacalle-shell-v0");

    await sw.dispatchLifecycle("activate");

    const remaining = await sw.caches.keys();
    expect(remaining).not.toContain("lacalle-shell-v0");
    expect(remaining).toContain("lacalle-shell-v1");
    expect(remaining.some((n) => n.includes("payload"))).toBe(true);
  });
});
