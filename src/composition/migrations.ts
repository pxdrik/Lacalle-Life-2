import type { Migration } from "@/core/storage/schema";
import { BODY_ENTRIES_STORE } from "@/features/body/data/body-repository";
import { DIETS_STORE } from "@/features/diet/data/diet-store";
import { FOODS_STORE } from "@/features/foods/data/food-store";
import { PROFILE_STORE } from "@/features/profile/data/profile-repository";
import { EXERCISES_STORE } from "@/features/workouts/data/exercise-repository";
import { ROUTINES_STORE } from "@/features/workouts/data/routine-repository";
import { SESSIONS_STORE } from "@/features/workouts/data/session-repository";

export const DATABASE_NAME = "lacalle-life";

/**
 * The application's schema history.
 *
 * It lives here, not in `core/storage`, because assembling it requires knowing
 * every feature — and a core module that imports features has its dependencies
 * backwards. Features declare the *shape* of their stores; this file decides
 * which version introduces them, since IndexedDB has one version counter for
 * the whole database and no feature can own that number alone.
 *
 * Rules:
 *   1. Append only. Never edit or renumber a released entry — an installed
 *      browser may hold any earlier version, and the path from it has to keep
 *      working.
 *   2. Entries are data. If a migration ever needs to transform existing rows,
 *      extend `Migration` rather than smuggling code in here.
 */
export const MIGRATIONS: readonly Migration[] = [
  {
    version: 1,
    description: "Food catalogue and user-created foods.",
    createStores: [FOODS_STORE],
  },
  {
    version: 2,
    description: "Diets, with their meals and items nested inside.",
    createStores: [DIETS_STORE],
  },
  {
    version: 3,
    description: "Optional physical profile, the input to calorie targets.",
    createStores: [PROFILE_STORE],
  },
  {
    version: 4,
    description: "Curated exercise catalogue and user-created exercises.",
    createStores: [EXERCISES_STORE],
  },
  {
    version: 5,
    description:
      "Routines (the plan) and sessions (what happened), kept apart on purpose.",
    createStores: [ROUTINES_STORE, SESSIONS_STORE],
  },
  {
    version: 6,
    description:
      "Body log: weight and tape measurements, one entry per day, indexed by day.",
    createStores: [BODY_ENTRIES_STORE],
  },
];
