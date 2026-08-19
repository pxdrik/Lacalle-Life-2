"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { describeDataError } from "@/core/domain/describe-data-error";
import type { EntityId } from "@/core/domain/entity";

import { useWorkoutRepositories } from "../data/workout-repository-context";
import { startSession } from "../services/start-session";
import type { Routine } from "../types/routine";

export type RoutineEditorState =
  | { readonly status: "loading" }
  | { readonly status: "missing" }
  | { readonly status: "ready"; readonly routine: Routine }
  | { readonly status: "error"; readonly message: string };

export interface RoutineEditor {
  readonly state: RoutineEditorState;
  readonly saveError: string | null;
  readonly apply: (change: (routine: Routine) => Routine) => void;
  /**
   * Takes the photograph and stores it. Resolves to the session's id so the
   * caller can navigate into the workout.
   */
  readonly start: () => Promise<string | null>;
}

/**
 * Loads one routine and persists every edit to it.
 *
 * Writes go out on each change with no debounce. A routine document is a few
 * kilobytes and a local write costs about a millisecond, so batching would
 * only add a window in which someone can close the tab and lose work.
 */
export function useRoutineEditor(routineId: EntityId): RoutineEditor {
  const repositories = useWorkoutRepositories();
  const [state, setState] = useState<RoutineEditorState>({ status: "loading" });
  const [saveError, setSaveError] = useState<string | null>(null);

  /**
   * Mirrors `state`, but written synchronously by `apply` itself rather than
   * read back from React's state. See the note on `apply` for why.
   */
  const stateRef = useRef(state);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const routine = await (await repositories).routines.getById(routineId);
        if (!active) return;
        const next: RoutineEditorState =
          routine === undefined
            ? { status: "missing" }
            : { status: "ready", routine };
        stateRef.current = next;
        setState(next);
      } catch (cause) {
        if (active) {
          const next: RoutineEditorState = {
            status: "error",
            message: describeDataError(cause),
          };
          stateRef.current = next;
          setState(next);
        }
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [repositories, routineId]);

  /**
   * The screen updates first, then storage. Waiting on a transaction per
   * keystroke would make the editor stutter; a failed save surfaces as a
   * banner without discarding the edit.
   *
   * Reads and writes `stateRef` rather than the functional form of
   * `setState`, on purpose — that used to be `setState((prevState) => {
   * ...; void persist(...); return next; })`, and it produced a real,
   * reproducible bug: the function passed to `setState` is a *render-phase*
   * function, and React Strict Mode (`reactStrictMode: true` in
   * `next.config.ts`) deliberately invokes it twice to catch exactly this —
   * an impure updater with a side effect inside it. Both invocations read the
   * same `prevState.routine.updatedAt` and both called `persist`, so adding
   * one exercise fired two writes racing on the same expected version; the
   * second always lost, surfacing as "Isso foi alterado em outro lugar" from
   * a single click on a single tab. `apply` itself is an ordinary callback,
   * not a render function, so React never double-invokes it — the ref gives
   * it the same "read the version this edit actually grew out of" guarantee
   * without living inside a function React is allowed to call twice.
   */
  const apply = useCallback(
    (change: (routine: Routine) => Routine) => {
      const prevState = stateRef.current;
      if (prevState.status !== "ready") return;

      const next = change(prevState.routine);
      // Edits addressing something already gone return the same routine.
      if (next === prevState.routine) return;

      const nextState: RoutineEditorState = { status: "ready", routine: next };
      stateRef.current = nextState;
      setState(nextState);

      void persist(next, prevState.routine.updatedAt);

      async function persist(routine: Routine, expectedUpdatedAt: number) {
        setSaveError(null);
        try {
          await (await repositories).routines.save(routine, expectedUpdatedAt);
        } catch (cause) {
          setSaveError(describeDataError(cause));
        }
      }
    },
    [repositories],
  );

  const start = useCallback(async (): Promise<string | null> => {
    if (state.status !== "ready") return null;
    setSaveError(null);

    const session = startSession(state.routine);

    try {
      await (await repositories).sessions.save(session, null);
      return session.id;
    } catch (cause) {
      setSaveError(describeDataError(cause));
      return null;
    }
  }, [state, repositories]);

  return { state, saveError, apply, start };
}
