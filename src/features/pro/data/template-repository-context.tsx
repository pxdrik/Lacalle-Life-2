"use client";

import { createContext, useContext } from "react";

import type { TemplateRepository } from "./template-repository";

const TemplateRepositoryContext = createContext<TemplateRepository | null>(null);

export function TemplateRepositoryProvider({
  repository,
  children,
}: {
  readonly repository: TemplateRepository;
  readonly children: React.ReactNode;
}) {
  return <TemplateRepositoryContext value={repository}>{children}</TemplateRepositoryContext>;
}

export function useTemplateRepository(): TemplateRepository {
  const repository = useContext(TemplateRepositoryContext);
  if (repository === null) {
    throw new Error("useTemplateRepository must be used within a TemplateRepositoryProvider.");
  }
  return repository;
}
