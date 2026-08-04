import type { IDBPDatabase } from "idb";

import { DATABASE_NAME, MIGRATIONS } from "../migrations";
import { openDatabase } from "./database";

/**
 * This application's single database connection, opened lazily on first use.
 *
 * Kept apart from `openDatabase` so the engine stays generic: nothing in
 * `database.ts` knows which database this app opens or what schema it
 * declares, which is why the migration tests can exercise it with schemas of
 * their own.
 */
let connection: Promise<IDBPDatabase> | undefined;

/**
 * A failed open is deliberately not cached. A transient failure — an upgrade
 * blocked by a tab the user then closes — is resolved by simply asking again.
 */
export function getDatabase(): Promise<IDBPDatabase> {
  connection ??= openDatabase(DATABASE_NAME, MIGRATIONS).catch(
    (error: unknown) => {
      connection = undefined;
      throw error;
    },
  );

  return connection;
}
