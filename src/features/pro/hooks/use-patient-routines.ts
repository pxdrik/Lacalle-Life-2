"use client";

import { useCallback, useEffect, useState } from "react";

import { useProRoutineRepository } from "../data/routine-repository-context";
import type { RoutineSummary } from "../types/routine";

export type PatientRoutinesState =
  | { readonly status: "loading" }
  | { readonly status: "error" }
  | { readonly status: "ready"; readonly routines: readonly RoutineSummary[] };

/** Os treinos de um vínculo, como o treinador vê (o par de `usePatientPlans`). */
export function usePatientRoutines(linkId: string) {
  const repository = useProRoutineRepository();
  const [state, setState] = useState<PatientRoutinesState>({ status: "loading" });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let active = true;
    repository
      .listRoutines(linkId)
      .then((routines) => {
        if (active) setState({ status: "ready", routines });
      })
      .catch(() => {
        if (active) setState({ status: "error" });
      });
    return () => {
      active = false;
    };
  }, [repository, linkId, version]);

  const reload = useCallback(() => {
    setVersion((current) => current + 1);
  }, []);

  return {
    state,
    reload,
    createRoutine: (name: string) => repository.createRoutine(linkId, name),
    publish: async (routineId: string, changeNote: string) => {
      const published = await repository.publish(routineId, changeNote);
      reload();
      return published;
    },
  };
}
