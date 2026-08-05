import type { StoreDefinition } from "@/core/storage/schema";

/**
 * One row per diet, meals and items nested inside it.
 *
 * No secondary indexes: the list screen reads every diet and sorts in memory,
 * and someone with more than a handful of diets is not a case worth indexing
 * for before it exists.
 */
export const DIETS_STORE: StoreDefinition = {
  name: "diets",
  keyPath: "id",
  indexes: [],
};
