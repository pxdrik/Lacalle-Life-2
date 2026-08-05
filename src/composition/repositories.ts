import type { IDBPDatabase } from "idb";

import { openDatabase } from "@/core/storage/indexeddb/database";
import { IndexedDbStore } from "@/core/storage/indexeddb/indexeddb-store";
import type { DietRepository } from "@/features/diet/data/diet-repository";
import { DIETS_STORE } from "@/features/diet/data/diet-store";
import { LocalDietRepository } from "@/features/diet/data/local-diet-repository";
import type { Diet } from "@/features/diet/types/diet";
import { seedCatalogue } from "@/features/foods/data/catalogue";
import { FOODS_STORE } from "@/features/foods/data/food-store";
import type { FoodRepository } from "@/features/foods/data/food-repository";
import { LocalFoodRepository } from "@/features/foods/data/local-food-repository";
import type { Food } from "@/features/foods/types/food";
import { LocalProfileRepository } from "@/features/profile/data/local-profile-repository";
import {
  PROFILE_STORE,
  type ProfileRepository,
} from "@/features/profile/data/profile-repository";
import type { Profile } from "@/features/profile/types/profile";

import { DATABASE_NAME, MIGRATIONS } from "./migrations";

/**
 * The composition root: the single place that knows which implementation
 * backs each repository interface.
 *
 * Swapping the local implementations for remote ones is a change to this file
 * and nothing else. Features depend on the interfaces in their own `data/`
 * folders and cannot see what is behind them.
 *
 * It sits outside `core/` because wiring requires importing features, and a
 * core module that imports features has its dependencies backwards.
 */
export interface Repositories {
  readonly foods: FoodRepository;
  readonly diets: DietRepository;
  readonly profile: ProfileRepository;
}

export function createRepositories(db: IDBPDatabase): Repositories {
  return {
    foods: new LocalFoodRepository(
      new IndexedDbStore<Food>(db, FOODS_STORE.name),
    ),
    diets: new LocalDietRepository(
      new IndexedDbStore<Diet>(db, DIETS_STORE.name),
    ),
    profile: new LocalProfileRepository(
      new IndexedDbStore<Profile>(db, PROFILE_STORE.name),
    ),
  };
}

let connection: Promise<Repositories> | undefined;

/**
 * The application's repositories, built once on first use.
 *
 * Seeding happens here rather than in a hook, so that a repository is always
 * handed out ready to read from — no caller has to remember to prime it.
 *
 * A failed open is deliberately not cached: a transient failure, such as an
 * upgrade blocked by a tab the user then closes, is resolved by asking again.
 */
export function getRepositories(): Promise<Repositories> {
  connection ??= build().catch((error: unknown) => {
    connection = undefined;
    throw error;
  });

  return connection;
}

async function build(): Promise<Repositories> {
  const db = await openDatabase(DATABASE_NAME, MIGRATIONS);
  const repositories = createRepositories(db);

  await seedCatalogue(repositories.foods);

  return repositories;
}
