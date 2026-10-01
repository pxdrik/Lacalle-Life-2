"use client";

import { useEffect, useState } from "react";

import { onStoreChanged } from "@/core/storage/store-events";

import { PRESCRIBED_PLANS_STORE } from "../data/prescribed-plan-repository";
import { useOptionalPrescribedPlanRepository } from "../data/prescribed-plan-repository-context";
import type { PrescribedPlan } from "../types/prescribed-plan";

export type PrescribedPlansState =
  | { readonly status: "loading" }
  | { readonly status: "ready"; readonly plans: readonly PrescribedPlan[] };

/**
 * Os planos recebidos da nutricionista. Sem repositório (conta anônima, tela
 * montada sem ele), nenhum plano: Dietas continua igual a antes do Life Pro.
 * Relê quando a sincronização troca a coleção.
 */
export function usePrescribedPlans(): PrescribedPlansState {
  const repository = useOptionalPrescribedPlanRepository();
  const [state, setState] = useState<PrescribedPlansState>(
    repository === null ? { status: "ready", plans: [] } : { status: "loading" },
  );

  useEffect(() => {
    if (repository === null) return;
    let active = true;
    const load = () => {
      repository
        .then((repo) => repo.listAll())
        .then((plans) => {
          if (active) setState({ status: "ready", plans });
        })
        // Ler o plano nunca pode derrubar Dietas: sem leitura, sem seção.
        .catch(() => {
          if (active) setState({ status: "ready", plans: [] });
        });
    };
    load();
    const unsubscribe = onStoreChanged(PRESCRIBED_PLANS_STORE.name, load);
    return () => {
      active = false;
      unsubscribe();
    };
  }, [repository]);

  return state;
}
