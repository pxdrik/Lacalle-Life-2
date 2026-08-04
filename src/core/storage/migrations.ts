import type { Migration } from "./schema";

export const DATABASE_NAME = "lacalle-life";

/**
 * The application's schema history.
 *
 * A single IndexedDB database has a single version number, so this list is
 * necessarily global — it is the one place features are not isolated from each
 * other, and that is a property of IndexedDB rather than a design choice.
 *
 * Rules:
 *   1. Append only. Never edit or renumber a released entry.
 *   2. One entry per feature that introduces storage.
 *   3. Entries are data. If a migration ever needs to transform existing rows,
 *      extend `Migration` rather than smuggling code in here.
 *
 * Empty until the first feature needs to persist something.
 */
export const MIGRATIONS: readonly Migration[] = [];
