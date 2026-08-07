"use client";

import { createContext, useContext } from "react";

import type { FoodLogRepository } from "./food-log-repository";

const FoodLogRepositoryContext =
  createContext<Promise<FoodLogRepository> | null>(null);

export function FoodLogRepositoryProvider({
  repository,
  children,
}: {
  readonly repository: Promise<FoodLogRepository>;
  readonly children: React.ReactNode;
}) {
  return (
    <FoodLogRepositoryContext value={repository}>
      {children}
    </FoodLogRepositoryContext>
  );
}

export function useFoodLogRepository(): Promise<FoodLogRepository> {
  const repository = useContext(FoodLogRepositoryContext);

  if (repository === null) {
    throw new Error(
      "useFoodLogRepository must be used within a FoodLogRepositoryProvider.",
    );
  }

  return repository;
}
