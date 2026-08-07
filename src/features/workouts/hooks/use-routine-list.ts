"use client";

import { useCallback, useEffect, useState } from "react";

import { describeDataError } from "@/core/domain/describe-data-error";

import { useWorkoutRepositories } from "../data/workout-repository-context";
import { createRoutine, duplicateRoutine } from "../services/create-routine";
import type { Routine } from "../types/routine";

export type RoutineListState =
  | { readonly status: "loading" }
  | { readonly status: "ready"; readonly routines: readonly Routine[] }
  | { readonly status: "error"; readonly message: string };

export interface RoutineList {
  readonly state: RoutineListState;
  readonly writeError: string | null;
  /** Resolves to the new routine's id so the caller can open it straight away. */
  readonly create: (name: string) => Promise<string | null>;
  /** Copies a whole routine. Stays on the list — you copied it to keep both. */
  readonly duplicate: (routine: Routine) => Promise<void>;
  readonly remove: (routine: Routine) => Promise<void>;
}

export function useRoutineList(): RoutineList {
  const repositories = useWorkoutRepositories();
  const [state, setState] = useState<RoutineListState>({ status: "loading" });
  const [writeError, setWriteError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const routines = await (await repositories).routines.listAll();
        if (active) setState({ status: "ready", routines });
      } catch (cause) {
        if (active) setState({ status: "error", message: describeDataError(cause) });
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [repositories]);

  const create = useCallback(
    async (name: string): Promise<string | null> => {
      setWriteError(null);
      const routine = createRoutine(name);

      try {
        await (await repositories).routines.save(routine);
        setState((current) =>
          current.status === "ready"
            ? { status: "ready", routines: [routine, ...current.routines] }
            : current,
        );
        return routine.id;
      } catch (cause) {
        setWriteError(describeDataError(cause));
        return null;
      }
    },
    [repositories],
  );

  const duplicate = useCallback(
    async (routine: Routine) => {
      setWriteError(null);
      const copy = duplicateRoutine(routine);

      try {
        await (await repositories).routines.save(copy);
        setState((current) =>
          current.status === "ready"
            ? { status: "ready", routines: [copy, ...current.routines] }
            : current,
        );
      } catch (cause) {
        setWriteError(describeDataError(cause));
      }
    },
    [repositories],
  );

  const remove = useCallback(
    async (routine: Routine) => {
      setWriteError(null);

      try {
        // Sessions are deliberately left alone. They are history, and history
        // does not disappear because the plan it came from did.
        await (await repositories).routines.remove(routine.id);
        setState((current) =>
          current.status === "ready"
            ? {
                status: "ready",
                routines: current.routines.filter((item) => item.id !== routine.id),
              }
            : current,
        );
      } catch (cause) {
        setWriteError(describeDataError(cause));
      }
    },
    [repositories],
  );

  return { state, writeError, create, duplicate, remove };
}
