"use client";

import { createContext, useContext } from "react";

import type { BodyRepository } from "./body-repository";

const BodyRepositoryContext = createContext<Promise<BodyRepository> | null>(null);

export function BodyRepositoryProvider({
  repository,
  children,
}: {
  readonly repository: Promise<BodyRepository>;
  readonly children: React.ReactNode;
}) {
  return (
    <BodyRepositoryContext value={repository}>{children}</BodyRepositoryContext>
  );
}

export function useBodyRepository(): Promise<BodyRepository> {
  const repository = useContext(BodyRepositoryContext);

  if (repository === null) {
    throw new Error(
      "useBodyRepository must be used within a BodyRepositoryProvider.",
    );
  }

  return repository;
}
