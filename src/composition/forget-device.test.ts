import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { openDatabase } from "@/core/storage/indexeddb/database";
import { createDiet } from "@/features/diet/services/create-diet";

import { APP_LOCAL_STORAGE_KEYS, forgetDevice } from "./forget-device";
import { DATABASE_NAME, MIGRATIONS } from "./migrations";
import { getRepositories } from "./repositories";

async function clearAllStores() {
  const db = await openDatabase(DATABASE_NAME, MIGRATIONS);
  const names = [...db.objectStoreNames];
  const tx = db.transaction(names, "readwrite");
  await Promise.all([
    ...names.map((name) => tx.objectStore(name).clear()),
    tx.done,
  ]);
}

/**
 * jsdom has no Cache Storage implementation at all — `src/service-worker/
 * sw.test.ts` works around the same gap with its own fake `caches` object,
 * because it loads `sw.js` into a sandbox it controls. `forgetDevice` calls
 * the real global instead (that is the whole point — it clears whatever a
 * real Service Worker actually wrote), so the global itself needs a minimal
 * stand-in here: open/put/keys/delete, enough to prove entries really go
 * away, nothing else `CacheStorage` offers.
 */
function stubCacheStorage() {
  const stores = new Map<string, Map<string, Response>>();

  const cacheStorage: Partial<CacheStorage> = {
    open: (name: string) =>
      Promise.resolve({
        put: (request: RequestInfo | URL, response: Response) => {
          const key = typeof request === "string" ? request : String(request);
          const store = stores.get(name) ?? new Map<string, Response>();
          store.set(key, response);
          stores.set(name, store);
          return Promise.resolve();
        },
      } as unknown as Cache),
    keys: () => Promise.resolve([...stores.keys()]),
    delete: (name: string) => Promise.resolve(stores.delete(name)),
  };

  vi.stubGlobal("caches", cacheStorage);
}

/**
 * jsdom does not implement `navigator.serviceWorker` at all — confirmed
 * directly (`'serviceWorker' in navigator` is `false` on a clean jsdom
 * window), not assumed. The 2026-08-24 pre-deploy review caught this: a
 * test here spied on `navigator.serviceWorker.getRegistrations` as though
 * the property already existed, and failed deterministically because
 * `vi.spyOn` has nothing to attach to on `undefined`.
 *
 * `Object.defineProperty` rather than `vi.stubGlobal("navigator", ...)`:
 * the latter would replace the whole `navigator` object, losing every other
 * property jsdom does provide (`userAgent`, `storage`, …) for tests that
 * don't even touch this one. This adds exactly the one property that is
 * missing, `configurable: true` so `afterEach` can remove it again and
 * leave `navigator` exactly as jsdom made it for every other test file.
 */
function stubServiceWorkerContainer() {
  Object.defineProperty(navigator, "serviceWorker", {
    value: { getRegistrations: () => Promise.resolve([]) },
    configurable: true,
    writable: true,
  });
}

function unstubServiceWorkerContainer() {
  const mutableNavigator = navigator as {
    serviceWorker?: ServiceWorkerContainer;
  };
  delete mutableNavigator.serviceWorker;
}

beforeAll(async () => {
  await getRepositories();
});

beforeEach(async () => {
  await clearAllStores();
  localStorage.clear();
  sessionStorage.clear();
  stubCacheStorage();
  stubServiceWorkerContainer();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  unstubServiceWorkerContainer();
});

describe("forgetDevice", () => {
  it("clears every IndexedDB store", async () => {
    const repositories = await getRepositories();
    await repositories.diets.save(createDiet("Will be forgotten"), null);

    await forgetDevice();

    await expect(repositories.diets.listAll()).resolves.toEqual([]);
  });

  it("clears localStorage", async () => {
    for (const key of APP_LOCAL_STORAGE_KEYS) localStorage.setItem(key, "x");
    localStorage.setItem("some-other-key", "should also go — clear() is origin-scoped");

    await forgetDevice();

    expect(localStorage.length).toBe(0);
  });

  it("clears sessionStorage", async () => {
    sessionStorage.setItem("whatever", "x");

    await forgetDevice();

    expect(sessionStorage.length).toBe(0);
  });

  it("deletes every Cache Storage entry", async () => {
    const cache = await caches.open("lacalle-shell-v6");
    await cache.put("/", new Response("shell"));

    await forgetDevice();

    await expect(caches.keys()).resolves.toEqual([]);
  });

  it("unregisters every Service Worker registration", async () => {
    const unregister = vi.fn().mockResolvedValue(true);
    vi.spyOn(navigator.serviceWorker, "getRegistrations").mockResolvedValue([
      { unregister } as unknown as ServiceWorkerRegistration,
    ]);

    await forgetDevice();

    expect(unregister).toHaveBeenCalledOnce();
  });

  it("leaves nothing behind for a fresh install to trip over", async () => {
    const repositories = await getRepositories();
    await repositories.diets.save(createDiet("Old data"), null);
    localStorage.setItem(APP_LOCAL_STORAGE_KEYS[0], "dark");
    const cache = await caches.open("lacalle-shell-v6");
    await cache.put("/", new Response("shell"));

    await forgetDevice();

    await expect(repositories.diets.listAll()).resolves.toEqual([]);
    expect(localStorage.length).toBe(0);
    await expect(caches.keys()).resolves.toEqual([]);
  });

  it("reports every mechanism as cleared on a full success", async () => {
    await expect(forgetDevice()).resolves.toEqual({
      caches: true,
      serviceWorker: true,
      localStorage: true,
      sessionStorage: true,
      indexedDb: true,
    });
  });

  /**
   * The exact scenario the 2026-08-24 pre-deploy review found unreported:
   * one mechanism fails, but that must never hide whether the others still
   * ran. `caches.delete` rejecting here must not stop `localStorage`,
   * `sessionStorage`, or IndexedDB from being cleared, and the result has to
   * name `caches` specifically as the one that did not — not just say
   * "something went wrong" the way the original version's thrown error did.
   */
  it("still clears every other mechanism, and reports exactly which one failed, when one mechanism throws", async () => {
    const repositories = await getRepositories();
    await repositories.diets.save(createDiet("Should still be forgotten"), null);
    localStorage.setItem(APP_LOCAL_STORAGE_KEYS[0], "dark");

    vi.stubGlobal("caches", {
      keys: () => Promise.reject(new Error("Cache Storage unavailable")),
    });

    const result = await forgetDevice();

    expect(result).toEqual({
      caches: false,
      serviceWorker: true,
      localStorage: true,
      sessionStorage: true,
      indexedDb: true,
    });
    // The point of the fix: IndexedDB and localStorage are gone even though
    // caches failed — nothing here is masked by the one failure.
    await expect(repositories.diets.listAll()).resolves.toEqual([]);
    expect(localStorage.length).toBe(0);
  });

  it("reports every mechanism as failed, and touches nothing, when every mechanism throws", async () => {
    const repositories = await getRepositories();
    await repositories.diets.save(createDiet("Should survive"), null);

    vi.stubGlobal("caches", {
      keys: () => Promise.reject(new Error("unavailable")),
    });
    vi.spyOn(navigator.serviceWorker, "getRegistrations").mockRejectedValue(
      new Error("unavailable"),
    );
    vi.spyOn(Storage.prototype, "clear").mockImplementation(() => {
      throw new Error("storage blocked");
    });
    vi.spyOn(indexedDB, "open").mockImplementation(() => {
      throw new Error("blocked");
    });

    const result = await forgetDevice();

    expect(result).toEqual({
      caches: false,
      serviceWorker: false,
      localStorage: false,
      sessionStorage: false,
      indexedDb: false,
    });
    await expect(repositories.diets.listAll()).resolves.toMatchObject([
      { name: "Should survive" },
    ]);
  });
});
