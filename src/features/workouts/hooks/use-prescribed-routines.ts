"use client";

import { useEffect, useState } from "react";

import { onStoreChanged } from "@/core/storage/store-events";

import { PRESCRIBED_ROUTINES_STORE } from "../data/prescribed-routine-repository";
import { useOptionalPrescribedRoutineRepository } from "../data/prescribed-routine-repository-context";
import type { PrescribedRoutine } from "../types/prescribed-routine";

export type PrescribedRoutinesState =
  | { readonly status: "loading" }
  | { readonly status: "ready"; readonly routines: readonly PrescribedRoutine[] };

/**
 * Os treinos recebidos do treinador. Sem repositório (conta anônima, tela
 * montada sem ele), nenhum: Treinos continua igual a antes do Life Pro.
 * Relê quando a sincronização troca a coleção.
 */
export function usePrescribedRoutines(): PrescribedRoutinesState {
  const repository = useOptionalPrescribedRoutineRepository();
  const [state, setState] = useState<PrescribedRoutinesState>(
    repository === null ? { status: "ready", routines: [] } : { status: "loading" },
  );

  useEffect(() => {
    if (repository === null) return;
    let active = true;
    const load = () => {
      repository
        .then((repo) => repo.listAll())
        .then((routines) => {
          if (active) setState({ status: "ready", routines });
        })
        // Ler o treino recebido nunca pode derrubar Treinos: sem leitura, sem seção.
        .catch(() => {
          if (active) setState({ status: "ready", routines: [] });
        });
    };
    load();
    const unsubscribe = onStoreChanged(PRESCRIBED_ROUTINES_STORE.name, load);
    return () => {
      active = false;
      unsubscribe();
    };
  }, [repository]);

  return state;
}
