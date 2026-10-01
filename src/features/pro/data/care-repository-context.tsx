"use client";

import { createContext, useContext } from "react";

import type { CareRepository } from "./care-repository";

const CareRepositoryContext = createContext<CareRepository | null>(null);

export function CareRepositoryProvider({
  repository,
  children,
}: {
  readonly repository: CareRepository;
  readonly children: React.ReactNode;
}) {
  return <CareRepositoryContext value={repository}>{children}</CareRepositoryContext>;
}

export function useCareRepository(): CareRepository {
  const repository = useContext(CareRepositoryContext);
  if (repository === null) {
    throw new Error("useCareRepository must be used within a CareRepositoryProvider.");
  }
  return repository;
}
