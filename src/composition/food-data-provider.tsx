"use client";

import type { FoodRepository } from "@/features/foods/data/food-repository";
import { FoodRepositoryProvider } from "@/features/foods/data/food-repository-context";

import { getRepositories } from "./repositories";

/**
 * Supplies the foods feature with its repository.
 *
 * This is the only place that knows a `FoodRepository` is backed by IndexedDB.
 * Pointing the feature at a remote implementation is a change to this file and
 * to `repositories.ts` — nothing in `features/foods` moves.
 */
let repository: Promise<FoodRepository> | undefined;

/**
 * Resolved once at module scope rather than per render, so the context value
 * is a stable reference and consuming effects do not re-run on every render.
 */
function foodRepository(): Promise<FoodRepository> {
  // A rejection is not cached: `getRepositories` already allows a retry after a
  // transient failure, and caching the rejected promise here would defeat that.
  repository ??= getRepositories()
    .then(({ foods }) => foods)
    .catch((error: unknown) => {
      repository = undefined;
      throw error;
    });

  return repository;
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
