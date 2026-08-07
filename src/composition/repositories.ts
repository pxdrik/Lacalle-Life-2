import type { IDBPDatabase } from "idb";

import { openDatabase } from "@/core/storage/indexeddb/database";
import { IndexedDbStore } from "@/core/storage/indexeddb/indexeddb-store";
import {
  BODY_ENTRIES_STORE,
  type BodyRepository,
} from "@/features/body/data/body-repository";
import { LocalBodyRepository } from "@/features/body/data/local-body-repository";
import type { BodyEntry } from "@/features/body/types/body-entry";
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
import {
  EXERCISES_STORE,
  type ExerciseRepository,
} from "@/features/workouts/data/exercise-repository";
import { LocalExerciseRepository } from "@/features/workouts/data/local-exercise-repository";
import {
  LocalRoutineRepository,
  ROUTINES_STORE,
  type RoutineRepository,
} from "@/features/workouts/data/routine-repository";
import {
  refreshExerciseMedia,
  seedExerciseCatalogue,
} from "@/features/workouts/data/seed-exercises";
import {
  LocalSessionRepository,
  SESSIONS_STORE,
  type SessionRepository,
} from "@/features/workouts/data/session-repository";
import type { Exercise } from "@/features/workouts/types/exercise";
import type { Routine } from "@/features/workouts/types/routine";
import type { Session } from "@/features/workouts/types/session";

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
  readonly body: BodyRepository;
  readonly foods: FoodRepository;
  readonly diets: DietRepository;
  readonly profile: ProfileRepository;
  readonly exercises: ExerciseRepository;
  readonly routines: RoutineRepository;
  readonly sessions: SessionRepository;
}

export function createRepositories(db: IDBPDatabase): Repositories {
  return {
    body: new LocalBodyRepository(
      new IndexedDbStore<BodyEntry>(db, BODY_ENTRIES_STORE.name),
    ),
    foods: new LocalFoodRepository(
      new IndexedDbStore<Food>(db, FOODS_STORE.name),
    ),
    diets: new LocalDietRepository(
      new IndexedDbStore<Diet>(db, DIETS_STORE.name),
    ),
    profile: new LocalProfileRepository(
      new IndexedDbStore<Profile>(db, PROFILE_STORE.name),
    ),
    exercises: new LocalExerciseRepository(
      new IndexedDbStore<Exercise>(db, EXERCISES_STORE.name),
    ),
    routines: new LocalRoutineRepository(
      new IndexedDbStore<Routine>(db, ROUTINES_STORE.name),
    ),
    sessions: new LocalSessionRepository(
      new IndexedDbStore<Session>(db, SESSIONS_STORE.name),
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

  // Both seeds skip themselves once their store holds anything, so this is
  // first-run work only. Run together because they are independent.
  await Promise.all([
    seedCatalogue(repositories.foods),
    // Seed then refresh, in order: on a first run the seed already writes the
    // current illustrations and the refresh finds nothing to do.
    seedExerciseCatalogue(repositories.exercises).then(() =>
      refreshExerciseMedia(repositories.exercises),
    ),
  ]);

  return repositories;
}
