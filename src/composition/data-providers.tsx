"use client";

import type { BodyRepository } from "@/features/body/data/body-repository";
import { BodyRepositoryProvider } from "@/features/body/data/body-repository-context";
import { DietRepositoryProvider } from "@/features/diet/data/diet-repository-context";
import type { FoodLogRepository } from "@/features/diet/data/food-log-repository";
import { FoodLogRepositoryProvider } from "@/features/diet/data/food-log-repository-context";
import { SyncingFoodLogRepository } from "@/features/diet/data/syncing-food-log-repository";
import type { DietRepository } from "@/features/diet/data/diet-repository";
import { FoodRepositoryProvider } from "@/features/foods/data/food-repository-context";
import type { FoodRepository } from "@/features/foods/data/food-repository";
import { BackupRepositoryProvider } from "@/features/profile/data/backup-repository-context";
import type {
  BackupRepository,
  ForgetDeviceResult,
} from "@/features/profile/data/backup-repository";
import { ProfileRepositoryProvider } from "@/features/profile/data/profile-repository-context";
import type { ProfileRepository } from "@/features/profile/data/profile-repository";
import { SyncingProfileRepository } from "@/features/profile/data/syncing-profile-repository";
import type { ExerciseRepository } from "@/features/workouts/data/exercise-repository";
import { ExerciseRepositoryProvider } from "@/features/workouts/data/exercise-repository-context";
import {
  WorkoutRepositoryProvider,
  type WorkoutRepositories,
} from "@/features/workouts/data/workout-repository-context";

import { openDatabase } from "@/core/storage/indexeddb/database";
import { IndexedDbStore } from "@/core/storage/indexeddb/indexeddb-store";
import { SYNC_TRACKER_STORE, type SyncTracker } from "@/core/sync/sync-tracker";

import { exportAll, importAll, previewImport } from "./backup";
import { forgetDevice as forgetDeviceDetailed } from "./forget-device";
import { currentDatabaseName } from "./identity";
import { MIGRATIONS } from "./migrations";
import { getRepositories } from "./repositories";

/**
 * Supplies each feature with its repository.
 *
 * This is the only module that knows those repositories are backed by
 * IndexedDB. Pointing a feature at a remote implementation is a change here
 * and in `repositories.ts` — nothing inside `features/` moves.
 */

/**
 * Resolves once and hands back the same promise, so the context value is a
 * stable reference and consuming effects do not re-run on every render.
 *
 * A rejection is not cached: `getRepositories` allows a retry after a
 * transient failure, and holding a rejected promise here would defeat that.
 */
function once<T>(resolve: () => Promise<T>): () => Promise<T> {
  let cached: Promise<T> | undefined;

  return () => {
    cached ??= resolve().catch((error: unknown) => {
      cached = undefined;
      throw error;
    });

    return cached;
  };
}

const bodyRepository = once<BodyRepository>(async () => {
  return (await getRepositories()).body;
});

export function BodyDataProvider({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  return (
    <BodyRepositoryProvider repository={bodyRepository()}>
      {children}
    </BodyRepositoryProvider>
  );
}

const foodRepository = once<FoodRepository>(async () => {
  return (await getRepositories()).foods;
});

/**
 * Decorado com o outbox de sync, mesmo motivo do `profileRepository`
 * abaixo — a UI nunca sabe que sync existe.
 */
const foodLogRepository = once<FoodLogRepository>(async () => {
  const local = (await getRepositories()).foodLogs;
  const db = await openDatabase(await currentDatabaseName(), MIGRATIONS);
  const tracker = new IndexedDbStore<SyncTracker>(db, SYNC_TRACKER_STORE.name);
  return new SyncingFoodLogRepository(local, tracker);
});

/**
 * The food log needs the foods (to add one to a meal), the diets (to start a
 * day from one) and the profile (to compare the day against a target).
 *
 * **The profile is the one that was missed, and it failed silently.**
 * `useNutritionTargets` reads through `useOptionalProfileRepository`, which
 * returns null without a provider rather than throwing — the design that keeps
 * the diet editor working for someone who never filled a profile in. Here that
 * same tolerance turned a wiring mistake into "the targets just never show
 * up", on the screen whose whole point is comparing what was eaten to a goal.
 */
export function FoodLogDataProvider({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  return (
    <FoodLogRepositoryProvider repository={foodLogRepository()}>
      <DietRepositoryProvider repository={dietRepository()}>
        <FoodRepositoryProvider repository={foodRepository()}>
          <ProfileRepositoryProvider repository={profileRepository()}>
            {children}
          </ProfileRepositoryProvider>
        </FoodRepositoryProvider>
      </DietRepositoryProvider>
    </FoodLogRepositoryProvider>
  );
}

const dietRepository = once<DietRepository>(async () => {
  return (await getRepositories()).diets;
});

/**
 * Decorado com o outbox de sync (`SyncingProfileRepository`) — toda escrita
 * grava local primeiro, exatamente como antes, e também marca uma
 * pendência de envio. Sem conta logada isso é inofensivo: a pendência fica
 * gravada e nunca é drenada, porque `pushProfile` devolve
 * `"not-authenticated"` sem fazer nada. Uma segunda conexão ao mesmo banco,
 * separada da que `getRepositories()` já abre — `idb` permite múltiplas
 * conexões simultâneas à mesma versão sem conflito.
 */
const profileRepository = once<ProfileRepository>(async () => {
  const local = (await getRepositories()).profile;
  const db = await openDatabase(await currentDatabaseName(), MIGRATIONS);
  const tracker = new IndexedDbStore<SyncTracker>(db, SYNC_TRACKER_STORE.name);
  return new SyncingProfileRepository(local, tracker);
});

/**
 * Narrows `forgetDeviceDetailed`'s per-mechanism result to what
 * `BackupRepository` exposes — see that type's own doc comment for why the
 * feature-facing contract stays a plain ok/partial shape rather than naming
 * `caches`/`serviceWorker`/`indexedDb` individually: those are composition's
 * concern, not the screen's.
 */
async function forgetDevice(): Promise<ForgetDeviceResult> {
  const detailed = await forgetDeviceDetailed();
  const values = Object.values(detailed);

  if (values.every(Boolean)) return { ok: true };

  return { ok: false, partiallyCompleted: values.some(Boolean) };
}

const backupRepository = once<BackupRepository>(() =>
  Promise.resolve({
    exportAll,
    importAll,
    previewImport: (raw: string) => Promise.resolve(previewImport(raw)),
    forgetDevice,
  }),
);

const exerciseRepository = once<ExerciseRepository>(async () => {
  return (await getRepositories()).exercises;
});

/**
 * The profile screen also reads the body log, to notice when the weight behind
 * someone's targets has gone stale. Composed here rather than nested at the
 * route, so a page never has to know which repositories a screen's components
 * happen to reach for.
 */
export function ProfileScreenDataProvider({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  return (
    <ProfileDataProvider>
      <BodyDataProvider>
        <BackupDataProvider>{children}</BackupDataProvider>
      </BodyDataProvider>
    </ProfileDataProvider>
  );
}

function BackupDataProvider({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  return (
    <BackupRepositoryProvider repository={backupRepository()}>
      {children}
    </BackupRepositoryProvider>
  );
}

export function ProfileDataProvider({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  return (
    <ProfileRepositoryProvider repository={profileRepository()}>
      {children}
    </ProfileRepositoryProvider>
  );
}

const workoutRepositories = once<WorkoutRepositories>(async () => {
  const { routines, sessions } = await getRepositories();
  return { routines, sessions };
});

export function ExerciseDataProvider({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  return (
    <ExerciseRepositoryProvider repository={exerciseRepository()}>
      {children}
    </ExerciseRepositoryProvider>
  );
}

/**
 * The routine builder picks exercises, so it needs the catalogue as well as
 * routines and sessions. Composed here so a route never has to know which
 * repositories a screen's components happen to reach for.
 */
export function WorkoutDataProvider({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  return (
    <WorkoutRepositoryProvider repositories={workoutRepositories()}>
      <ExerciseDataProvider>{children}</ExerciseDataProvider>
    </WorkoutRepositoryProvider>
  );
}

export function FoodDataProvider({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  return (
    <FoodRepositoryProvider repository={foodRepository()}>
      {children}
    </FoodRepositoryProvider>
  );
}

export function DietDataProvider({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  return (
    <DietRepositoryProvider repository={dietRepository()}>
      {children}
    </DietRepositoryProvider>
  );
}

/**
 * The home screen reads across the app and writes nothing.
 *
 * Deliberately narrower than the screens it summarises: it needs today's food
 * log, the profile behind the targets, the sessions, and the body log behind
 * the weight — but not the foods (it adds nothing to a meal), not the diets
 * (it starts no day from one) and not the exercise catalogue (it names
 * sessions, never their exercises). Wiring those in anyway would cost three
 * IndexedDB opens on the first screen of the app for data nothing on it reads.
 *
 * The body log joined the list when the screen grew a weight card. It was
 * excluded here on the grounds that nothing read it, and that stopped being
 * true — which is the whole point of stating the reason rather than the rule.
 */
export function HomeDataProvider({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  return (
    <FoodLogRepositoryProvider repository={foodLogRepository()}>
      <ProfileRepositoryProvider repository={profileRepository()}>
        <WorkoutRepositoryProvider repositories={workoutRepositories()}>
          <BodyRepositoryProvider repository={bodyRepository()}>
            {children}
          </BodyRepositoryProvider>
        </WorkoutRepositoryProvider>
      </ProfileRepositoryProvider>
    </FoodLogRepositoryProvider>
  );
}

/**
 * The diet editor picks foods and, when a profile exists, compares its totals
 * against that profile's targets. Composed here rather than nested at the
 * page, so a route never has to know which repositories a screen's components
 * happen to reach for.
 */
export function DietEditorDataProvider({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  return (
    <DietDataProvider>
      <FoodDataProvider>
        <ProfileDataProvider>{children}</ProfileDataProvider>
      </FoodDataProvider>
    </DietDataProvider>
  );
}
