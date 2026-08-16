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
  | { readonly ok: true; readonly recordCount: number }
  | { readonly ok: false; readonly reason: "invalid" | "incompatible" };

export interface BackupRepository {
  /** Everything needed to reconstruct the app's state, ready to serialise. */
  exportAll(): Promise<unknown>;
  /** Validates before writing anything; never partially replaces the database. */
  importAll(raw: string): Promise<ImportResult>;
}
