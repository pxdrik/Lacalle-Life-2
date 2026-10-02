"use client";

import { createContext, useContext } from "react";

import type { FollowUpRepository } from "./follow-up-repository";

const FollowUpRepositoryContext = createContext<FollowUpRepository | null>(null);

export function FollowUpRepositoryProvider({
  repository,
  children,
}: {
  readonly repository: FollowUpRepository;
  readonly children: React.ReactNode;
}) {
  return <FollowUpRepositoryContext value={repository}>{children}</FollowUpRepositoryContext>;
}

export function useFollowUpRepository(): FollowUpRepository {
  const repository = useContext(FollowUpRepositoryContext);
  if (repository === null) {
    throw new Error("useFollowUpRepository must be used within a FollowUpRepositoryProvider.");
  }
  return repository;
}
