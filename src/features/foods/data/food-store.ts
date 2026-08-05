import type { StoreDefinition } from "@/core/storage/schema";

/**
 * The physical shape of the foods store.
 *
 * The feature owns this; the composition root decides which schema *version*
 * introduces it, because IndexedDB has one version counter for the whole
 * database and no single feature can own that number.
 *
 * No secondary indexes. The catalogue is a few hundred rows that the app reads
 * once and filters in memory, so an index would cost writes and buy nothing.
 * When a query appears that needs one, it arrives as its own migration.
 */
export const FOODS_STORE: StoreDefinition = {
  name: "foods",
  keyPath: "id",
  indexes: [],
};
