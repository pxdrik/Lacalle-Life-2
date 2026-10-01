"use client";

import { createContext, useContext } from "react";

import type { ProRepository } from "./pro-repository";

const ProRepositoryContext = createContext<ProRepository | null>(null);

export function ProRepositoryProvider({
  repository,
  children,
}: {
  readonly repository: ProRepository;
  readonly children: React.ReactNode;
}) {
  return <ProRepositoryContext value={repository}>{children}</ProRepositoryContext>;
}

export function useProRepository(): ProRepository {
  const repository = useContext(ProRepositoryContext);
  if (repository === null) {
    throw new Error("useProRepository must be used within a ProRepositoryProvider.");
  }
  return repository;
}
