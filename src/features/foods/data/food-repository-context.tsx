"use client";

import { createContext, useContext } from "react";

import type { FoodRepository } from "./food-repository";

/**
 * How this feature receives its repository.
 *
 * Declaring the injection point here — next to the interface it injects —
 * is what keeps the dependency arrow pointing one way. The composition root
 * imports this and supplies an implementation; nothing in the feature imports
 * the composition root back.
 *
 * A promise rather than a resolved value, because opening local storage is
 * asynchronous and the alternative is a second loading state stacked on top of
 * the one the data hooks already own.
 */
const FoodRepositoryContext = createContext<Promise<FoodRepository> | null>(
  null,
);

export function FoodRepositoryProvider({
  repository,
  children,
}: {
  readonly repository: Promise<FoodRepository>;
  readonly children: React.ReactNode;
}) {
  return (
    <FoodRepositoryContext value={repository}>{children}</FoodRepositoryContext>
  );
}

export function useFoodRepository(): Promise<FoodRepository> {
  const repository = useContext(FoodRepositoryContext);

  if (repository === null) {
    throw new Error(
      "useFoodRepository must be used within a FoodRepositoryProvider.",
    );
  }

  return repository;
}
