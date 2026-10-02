"use client";

import { createContext, useContext } from "react";

import type { PrescribedRoutineRepository } from "./prescribed-routine-repository";

/**
 * Opcional, como o dos planos: quem monta Treinos sem ele (a conta anônima, um
 * teste) continua funcionando, só sem a seção "Do seu treinador".
 */
const PrescribedRoutineRepositoryContext = createContext<Promise<PrescribedRoutineRepository> | null>(null);

export function PrescribedRoutineRepositoryProvider({
  repository,
  children,
}: {
  readonly repository: Promise<PrescribedRoutineRepository>;
  readonly children: React.ReactNode;
}) {
  return <PrescribedRoutineRepositoryContext value={repository}>{children}</PrescribedRoutineRepositoryContext>;
}

export function useOptionalPrescribedRoutineRepository(): Promise<PrescribedRoutineRepository> | null {
  return useContext(PrescribedRoutineRepositoryContext);
}
