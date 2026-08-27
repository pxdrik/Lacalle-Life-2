/**
 * The whole-database backup, seen from the feature side.
 *
 * Deliberately opaque about what `exportAll` returns and what `importAll`
 * reads: this interface would otherwise have to name `Diet`, `Routine`,
 * `Session` and five other features' types, which is exactly the dependency
 * direction `no-restricted-imports` exists to block. The screen that offers
 * backup does not need to know the file's shape — only that exporting
 * produces something JSON-serialisable and importing reports what happened.
 */
export type ImportResult =
  | {
      readonly ok: true;
      readonly recordCount: number;
      /** Records kept only after nulling one out-of-range legacy field. */
      readonly sanitizedCount: number;
      /** Records that could not be recovered safely, and were dropped. */
      readonly discardedCount: number;
    }
  | { readonly ok: false; readonly reason: "invalid" | "incompatible" };

/**
 * `forgetDevice` clears five independent mechanisms (IndexedDB, two Web
 * Storages, Cache Storage, the Service Worker registration) and none of
 * them can be rolled back if a later one fails. `partiallyCompleted`
 * exists so the screen can tell "nothing happened, try again" apart from
 * "some of this is already gone, whatever you do next should not assume
 * this device still has your data" — two different sentences, not one
 * generic failure message standing in for both.
 */
export type ForgetDeviceResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly partiallyCompleted: boolean };

export interface BackupRepository {
  /** Everything needed to reconstruct the app's state, ready to serialise. */
  exportAll(): Promise<unknown>;
  /**
   * Validates and counts records without writing anything — what the
   * confirmation step shows before the second, destructive tap.
   */
  previewImport(raw: string): Promise<ImportResult>;
  /** Validates before writing anything; never partially replaces the database. */
  importAll(raw: string): Promise<ImportResult>;
  /**
   * Erases every trace of the app from this browser — every IndexedDB store,
   * `localStorage`, `sessionStorage`, every Service Worker cache, and the
   * Service Worker registration itself. See `composition/forget-device.ts`
   * for exactly what that covers, why IndexedDB is cleared last, and why the
   * result is not a bare boolean.
   */
  forgetDevice(): Promise<ForgetDeviceResult>;
}
