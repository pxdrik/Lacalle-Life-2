"use client";

import { createContext, useContext } from "react";

import type { PrescribedPlanRepository } from "./prescribed-plan-repository";

/**
 * Opcional, como o perfil: quem monta Dietas sem planos (a conta anônima, um
 * teste) continua funcionando, só sem a seção "Do seu treinador".
 */
const PrescribedPlanRepositoryContext = createContext<Promise<PrescribedPlanRepository> | null>(null);

export function PrescribedPlanRepositoryProvider({
  repository,
  children,
}: {
  readonly repository: Promise<PrescribedPlanRepository>;
  readonly children: React.ReactNode;
}) {
  return <PrescribedPlanRepositoryContext value={repository}>{children}</PrescribedPlanRepositoryContext>;
}

export function useOptionalPrescribedPlanRepository(): Promise<PrescribedPlanRepository> | null {
  return useContext(PrescribedPlanRepositoryContext);
}
