/**
 * Schema is declared as data, not as code that runs inside an upgrade
 * transaction.
 *
 * IndexedDB upgrades are the least forgiving place in the browser: they run in
 * a special transaction, they cannot await unrelated work, and a throw leaves
 * the database at the old version. Describing a migration as a plain object
 * removes the opportunity to write something unsafe there, and makes the
 * schema at any version readable without executing anything.
 */

export interface IndexDefinition {
  readonly name: string;
  /**
   * Property to index. Dotted paths address nested properties, matching
   * IndexedDB's own key path syntax.
   *
   * Compound (array) key paths are deliberately unsupported: nothing needs
   * them yet, and both adapters would have to grow key-tuple comparison to
   * agree with each other.
   */
  readonly keyPath: string;
}

export interface StoreDefinition {
  readonly name: string;
  readonly keyPath: string;
  readonly indexes: readonly IndexDefinition[];
}

/**
 * One numbered step. Steps are append-only and never edited once released —
 * an installed browser may hold any earlier version, and the upgrade path from
 * it has to keep working.
 */
export interface Migration {
  readonly version: number;
  readonly description: string;
  readonly createStores?: readonly StoreDefinition[];
  readonly dropStores?: readonly string[];
  readonly addIndexes?: readonly {
    readonly store: string;
    readonly index: IndexDefinition;
  }[];
}

/**
 * IndexedDB versions start at 1, so an app with no migrations yet still opens
 * a valid (empty) database.
 */
export function databaseVersion(migrations: readonly Migration[]): number {
  return migrations.reduce((max, m) => Math.max(max, m.version), 1);
}

export function sortedMigrations(
  migrations: readonly Migration[],
): readonly Migration[] {
  return [...migrations].sort((a, b) => a.version - b.version);
}
