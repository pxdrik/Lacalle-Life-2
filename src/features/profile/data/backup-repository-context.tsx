"use client";

import { createContext, useContext } from "react";

import type { BackupRepository } from "./backup-repository";

const BackupRepositoryContext =
  createContext<Promise<BackupRepository> | null>(null);

export function BackupRepositoryProvider({
  repository,
  children,
}: {
  readonly repository: Promise<BackupRepository>;
  readonly children: React.ReactNode;
}) {
  return (
    <BackupRepositoryContext value={repository}>
      {children}
    </BackupRepositoryContext>
  );
}

export function useBackupRepository(): Promise<BackupRepository> {
  const repository = useContext(BackupRepositoryContext);

  if (repository === null) {
    throw new Error(
      "useBackupRepository must be used within a BackupRepositoryProvider.",
    );
  }

  return repository;
}
