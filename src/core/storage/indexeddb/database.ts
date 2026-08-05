import { openDB, type IDBPDatabase } from "idb";

import { toDataError } from "../errors";
import { databaseVersion, sortedMigrations, type Migration } from "../schema";

/**
 * Opens a database and brings it up to the latest schema version.
 *
 * `name` and `migrations` are parameters rather than module constants so that
 * tests can open isolated databases with their own schema — the engine is
 * exercised generically, not against whatever the app happens to declare.
 */
export async function openDatabase(
  name: string,
  migrations: readonly Migration[],
): Promise<IDBPDatabase> {
  const ordered = sortedMigrations(migrations);

  try {
    return await openDB(name, databaseVersion(migrations), {
      upgrade(db, oldVersion, _newVersion, tx) {
        for (const migration of ordered) {
          if (migration.version <= oldVersion) continue;

          for (const storeName of migration.dropStores ?? []) {
            if (db.objectStoreNames.contains(storeName)) {
              db.deleteObjectStore(storeName);
            }
          }

          for (const definition of migration.createStores ?? []) {
            const store = db.createObjectStore(definition.name, {
              keyPath: definition.keyPath,
            });
            for (const index of definition.indexes) {
              store.createIndex(index.name, index.keyPath);
            }
          }

          for (const { store, index } of migration.addIndexes ?? []) {
            tx.objectStore(store).createIndex(index.name, index.keyPath);
          }
        }
      },

      /**
       * Another tab is holding an older connection open, so this upgrade
       * cannot start. Nothing here can force it shut; the other tab's
       * `blocking` handler is what resolves it.
       */
      blocked() {
        console.warn(
          `[storage] Upgrade of "${name}" is blocked by another open tab.`,
        );
      },

      /**
       * A newer version is waiting elsewhere. Close so the other tab can
       * proceed instead of both deadlocking.
       */
      blocking(_currentVersion, _blockedVersion, event) {
        (event.target as IDBPDatabase | null)?.close();
      },
    });
  } catch (cause) {
    throw toDataError(cause);
  }
}
