"use client";

import { createContext, useContext } from "react";

import type { DietRepository } from "./diet-repository";

/**
 * How this feature receives its repository. The composition root fills it;
 * nothing here imports the composition root back.
 */
const DietRepositoryContext = createContext<Promise<DietRepository> | null>(
  null,
);

export function DietRepositoryProvider({
  repository,
  children,
}: {
  readonly repository: Promise<DietRepository>;
  readonly children: React.ReactNode;
}) {
  return (
    <DietRepositoryContext value={repository}>{children}</DietRepositoryContext>
  );
}

export function useDietRepository(): Promise<DietRepository> {
  const repository = useContext(DietRepositoryContext);

  if (repository === null) {
    throw new Error(
      "useDietRepository must be used within a DietRepositoryProvider.",
    );
  }

  return repository;
}
