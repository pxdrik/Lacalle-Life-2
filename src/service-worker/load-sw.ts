import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Runs the actual `public/sw.js` — not a reimplementation of its logic — in a
 * fake service-worker global scope, so a test failure here means the shipped
 * file is wrong, not that a parallel copy of it drifted from the real one.
 *
 * `caches`, `fetch` and `self` are the only globals the script touches; each
 * fake below is the smallest thing that satisfies what `sw.js` actually calls
 * on it, not a full Cache API polyfill.
 */

export interface FakeResponse {
  readonly ok: boolean;
  readonly status: number;
  clone(): FakeResponse;
}

export function fakeResponse(status = 200): FakeResponse {
  return {
    ok: status >= 200 && status < 300,
    status,
    clone() {
      return fakeResponse(status);
    },
  };
}

/**
 * Mirrors what the real `Request` constructor does with a relative URL:
 * resolves it against the worker's own origin. Without this,
 * `caches.match("/")` — the shell fallback in `networkFirst` — would never
 * match an entry stored under the absolute URL `https://…/`.
 */
function keyOf(request: FakeRequest | string): string {
  const raw = typeof request === "string" ? request : request.url;
  return new URL(raw, "https://lacalle.example").href;
}

export interface FakeRequest {
  readonly url: string;
  readonly method?: string;
  readonly mode?: string;
}

class FakeCache {
  private readonly entries = new Map<string, FakeResponse>();

  match(request: FakeRequest | string): FakeResponse | undefined {
    return this.entries.get(keyOf(request));
  }

  async put(request: FakeRequest | string, response: FakeResponse) {
    this.entries.set(keyOf(request), response);
  }

  async delete(request: FakeRequest | string): Promise<boolean> {
    return this.entries.delete(keyOf(request));
  }

  /** Insertion order, same guarantee the real Cache API makes. */
  async keys(): Promise<FakeRequest[]> {
    return [...this.entries.keys()].map((url) => ({ url }));
  }

  get size(): number {
    return this.entries.size;
  }
}

export class FakeCacheStorage {
  private readonly caches = new Map<string, FakeCache>();

  async open(name: string): Promise<FakeCache> {
    let cache = this.caches.get(name);
    if (cache === undefined) {
      cache = new FakeCache();
      this.caches.set(name, cache);
    }
    return cache;
  }

  async keys(): Promise<string[]> {
    return [...this.caches.keys()];
  }

  async delete(name: string): Promise<boolean> {
    return this.caches.delete(name);
  }

  /** Mirrors `CacheStorage.match`: searches every cache, first match wins. */
  async match(
    request: FakeRequest | string,
  ): Promise<FakeResponse | undefined> {
    for (const cache of this.caches.values()) {
      const hit = cache.match(request);
      if (hit !== undefined) return hit;
    }
    return undefined;
  }

  /** Test-only: reaches into a named cache without going through the SW. */
  peek(name: string): FakeCache | undefined {
    return this.caches.get(name);
  }
}

interface FakeEvent {
  readonly request?: FakeRequest;
  respondWith(value: unknown): void;
  waitUntil(value: unknown): void;
  result: unknown;
}

type Listener = (event: FakeEvent) => void;

export interface LoadedServiceWorker {
  readonly caches: FakeCacheStorage;
  readonly fetch: (request: FakeRequest) => Promise<FakeResponse>;
  /** Dispatches a fake `fetch` event and returns what `respondWith` got. */
  dispatchFetch(request: FakeRequest): Promise<unknown>;
  /** Dispatches `install` or `activate` and returns what `waitUntil` got. */
  dispatchLifecycle(type: "install" | "activate"): Promise<unknown>;
}

export function loadServiceWorker(
  fetchImpl: (request: FakeRequest) => Promise<FakeResponse>,
): LoadedServiceWorker {
  const code = readFileSync(
    path.join(process.cwd(), "public/sw.js"),
    "utf8",
  );

  const listeners = new Map<string, Listener>();
  const fakeSelf = {
    location: { origin: "https://lacalle.example" },
    addEventListener(type: string, listener: Listener) {
      listeners.set(type, listener);
    },
    skipWaiting: async () => undefined,
    clients: { claim: async () => undefined },
  };

  const fakeCaches = new FakeCacheStorage();

  const run = new Function("self", "caches", "fetch", code) as (
    selfArg: unknown,
    cachesArg: unknown,
    fetchArg: unknown,
  ) => void;
  run(fakeSelf, fakeCaches, fetchImpl);

  async function fireOn(type: string, event: FakeEvent): Promise<unknown> {
    const listener = listeners.get(type);
    if (listener === undefined) {
      throw new Error(`sw.js never registered a "${type}" listener`);
    }
    listener(event);
    return event.result;
  }

  return {
    caches: fakeCaches,
    fetch: fetchImpl,
    dispatchFetch(request) {
      const event: FakeEvent = {
        request: { method: "GET", mode: "navigate", ...request },
        result: undefined,
        respondWith(value) {
          this.result = value;
        },
        waitUntil() {
          // Unused by the fetch listener.
        },
      };
      return fireOn("fetch", event);
    },
    dispatchLifecycle(type) {
      const event: FakeEvent = {
        result: undefined,
        respondWith() {
          // Unused by install/activate.
        },
        waitUntil(value) {
          this.result = value;
        },
      };
      return fireOn(type, event);
    },
  };
}
