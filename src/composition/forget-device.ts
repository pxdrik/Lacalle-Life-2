import { openDatabase } from "@/core/storage/indexeddb/database";

import { currentDatabaseName } from "./identity";
import { MIGRATIONS } from "./migrations";

/**
 * Every persistent resource this app writes to a browser, in one place — so
 * "forget everything" has one list to be right about instead of one per
 * mechanism.
 *
 * - **IndexedDB** (`lacalle-life`, opened via `openDatabase`) — every domain
 *   store: body, food logs, foods, diets, profile, exercises, routines,
 *   sessions.
 * - **localStorage** — four keys, all under this origin: theme
 *   (`lacalle-life.theme`), density (`lacalle-life.density`), training-days
 *   (`lacalle-life.training-days`) and the exercise-media cache-buster
 *   (`lacalle-life:exercise-media-revision`).
 * - **sessionStorage** — unused today, cleared anyway so a future write to it
 *   is covered by construction rather than by remembering to update this list.
 * - **Cache Storage** — the three caches `public/sw.js` maintains
 *   (`lacalle-shell-*`, `lacalle-assets-*`, `lacalle-payloads-*`).
 * - **The Service Worker registration itself** — so the next visit installs
 *   fresh rather than reusing whatever this one already had running.
 *
 * `localStorage.clear()` and `sessionStorage.clear()` are safe rather than a
 * shortcut: both are already scoped to this origin by the browser, and no
 * other app shares it — there is nothing under either to preserve. The same
 * is true of `caches`. This is the opposite of a browser-wide "clear site
 * data": every one of these calls only ever reaches what `lacalle-life.
 * vercel.app` itself wrote.
 */
export const APP_LOCAL_STORAGE_KEYS = [
  "lacalle-life.theme",
  "lacalle-life.density",
  "lacalle-life.training-days",
  "lacalle-life:exercise-media-revision",
] as const;

/**
 * Which of {@link forgetDevice}'s mechanisms were actually cleared.
 *
 * Not every failure means nothing happened — see {@link forgetDevice}'s own
 * doc comment for why each mechanism is caught independently. A caller that
 * only checks "did the promise reject" cannot tell "erased everything"
 * apart from "erased everything except the one thing that's actually still
 * yours", and those are different enough sentences to owe the person a
 * different one back.
 */
export interface ForgetDeviceResult {
  readonly caches: boolean;
  readonly serviceWorker: boolean;
  readonly localStorage: boolean;
  readonly sessionStorage: boolean;
  readonly indexedDb: boolean;
}

/**
 * Erases every trace of this app from the current browser profile.
 *
 * Deliberately not exposed as an `importAll` of an empty backup: that path
 * still requires a *file*, and this is meant for someone who wants a clean
 * slate without producing or discarding one — "I'm handing this phone to
 * someone else" or "I want to start over completely", not "I have a backup
 * to restore instead". The two are unrelated, and conflating them would make
 * this action live behind an unrelated file picker.
 *
 * IndexedDB stores are cleared, not the database dropped: `openDatabase`
 * caches its connection at module scope for the app's lifetime, and calling
 * `indexedDB.deleteDatabase` while that connection is still open blocks
 * until every connection closes — which, in a running tab, is never. Clearing
 * every store inside one transaction reaches the same end state (nothing
 * left) without that deadlock, and is the same technique `importAll` already
 * uses for a full replace.
 *
 * **Each mechanism is caught independently, and every one always runs.**
 * The 2026-08-24 pre-deploy review found the original version threw on the
 * first failure — IndexedDB was cleared first and unconditionally, so a
 * later, genuinely minor failure (`caches.delete` rejecting, `serviceWorker.
 * getRegistrations()` erroring) surfaced to the person as "não foi possível
 * apagar os dados deste dispositivo", while the one irreversible thing had,
 * in fact, already happened — a straightforwardly false message. There is
 * no rollback for a cleared object store, so the fix is not to invent one:
 * it is to never let one mechanism's failure hide whether the others ran,
 * and to report exactly which of the five actually completed in
 * {@link ForgetDeviceResult} rather than a single ok/failed bit. The caller
 * — `composition/data-providers.tsx`'s `forgetDevice` wrapper — turns that
 * into "ok", or "failed, and here's whether anything was already erased".
 */
export async function forgetDevice(): Promise<ForgetDeviceResult> {
  const result: ForgetDeviceResult = {
    caches: await clearCaches(),
    serviceWorker: await unregisterServiceWorkers(),
    localStorage: clearWebStorage("localStorage"),
    sessionStorage: clearWebStorage("sessionStorage"),
    indexedDb: await clearIndexedDb(),
  };

  return result;
}

async function clearIndexedDb(): Promise<boolean> {
  try {
    const db = await openDatabase(await currentDatabaseName(), MIGRATIONS);
    const names = [...db.objectStoreNames];
    const tx = db.transaction(names, "readwrite");
    await Promise.all([
      ...names.map((name) => tx.objectStore(name).clear()),
      tx.done,
    ]);
    return true;
  } catch {
    return false;
  }
}

function clearWebStorage(kind: "localStorage" | "sessionStorage"): boolean {
  try {
    const storage = kind === "localStorage" ? localStorage : sessionStorage;
    if (typeof storage === "undefined") return true;
    storage.clear();
    return true;
  } catch {
    return false;
  }
}

async function clearCaches(): Promise<boolean> {
  try {
    if (typeof caches === "undefined") return true;
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map((name) => caches.delete(name)));
    return true;
  } catch {
    return false;
  }
}

async function unregisterServiceWorkers(): Promise<boolean> {
  try {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
      return true;
    }
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(
      registrations.map((registration) => registration.unregister()),
    );
    return true;
  } catch {
    return false;
  }
}
