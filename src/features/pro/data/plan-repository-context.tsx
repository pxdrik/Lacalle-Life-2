"use client";

import { createContext, useContext } from "react";

import type { PlanRepository } from "./plan-repository";

const PlanRepositoryContext = createContext<PlanRepository | null>(null);

export function PlanRepositoryProvider({
  repository,
  children,
}: {
  readonly repository: PlanRepository;
  readonly children: React.ReactNode;
}) {
  return <PlanRepositoryContext value={repository}>{children}</PlanRepositoryContext>;
}

export function usePlanRepository(): PlanRepository {
  const repository = useContext(PlanRepositoryContext);
  if (repository === null) {
    throw new Error("usePlanRepository must be used within a PlanRepositoryProvider.");
  }
  return repository;
}
