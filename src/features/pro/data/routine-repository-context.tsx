"use client";

import { createContext, useContext } from "react";

import type { ProRoutineRepository } from "./routine-repository";

const RoutineRepositoryContext = createContext<ProRoutineRepository | null>(null);

export function ProRoutineRepositoryProvider({
  repository,
  children,
}: {
  readonly repository: ProRoutineRepository;
  readonly children: React.ReactNode;
}) {
  return <RoutineRepositoryContext value={repository}>{children}</RoutineRepositoryContext>;
}

export function useProRoutineRepository(): ProRoutineRepository {
  const repository = useContext(RoutineRepositoryContext);
  if (repository === null) {
    throw new Error("useProRoutineRepository must be used within a ProRoutineRepositoryProvider.");
  }
  return repository;
}
