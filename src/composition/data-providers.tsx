"use client";

import { DietRepositoryProvider } from "@/features/diet/data/diet-repository-context";
import type { DietRepository } from "@/features/diet/data/diet-repository";
import { FoodRepositoryProvider } from "@/features/foods/data/food-repository-context";
import type { FoodRepository } from "@/features/foods/data/food-repository";
import { ProfileRepositoryProvider } from "@/features/profile/data/profile-repository-context";
import type { ProfileRepository } from "@/features/profile/data/profile-repository";
import type { ExerciseRepository } from "@/features/workouts/data/exercise-repository";
import { ExerciseRepositoryProvider } from "@/features/workouts/data/exercise-repository-context";

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

const foodRepository = once<FoodRepository>(async () => {
  return (await getRepositories()).foods;
});

const dietRepository = once<DietRepository>(async () => {
  return (await getRepositories()).diets;
});

const profileRepository = once<ProfileRepository>(async () => {
  return (await getRepositories()).profile;
});

const exerciseRepository = once<ExerciseRepository>(async () => {
  return (await getRepositories()).exercises;
});

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
