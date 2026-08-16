"use client";

import { useCallback, useEffect, useState } from "react";

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

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const routine = await (await repositories).routines.getById(routineId);
        if (!active) return;
        setState(
          routine === undefined
            ? { status: "missing" }
            : { status: "ready", routine },
        );
      } catch (cause) {
        if (active)
          setState({ status: "error", message: describeDataError(cause) });
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
   * The functional form of `setState` matters here beyond React convention:
   * when several `apply()` calls land in the same batch — two fields edited
   * fast enough to land in one tick — each updater sees the *previous
   * updater's* result as `prevState`, not the stale value this closure was
   * created with. That is what makes the edits compose instead of the last
   * one silently winning, and it is also where the version passed to `save`
   * comes from: each write's expected version is exactly the version the
   * updater it grew out of actually read.
   */
  const apply = useCallback(
    (change: (routine: Routine) => Routine) => {
      setState((prevState) => {
        if (prevState.status !== "ready") return prevState;

        const next = change(prevState.routine);
        // Edits addressing something already gone return the same routine.
        if (next === prevState.routine) return prevState;

        void persist(next, prevState.routine.updatedAt);
        return { status: "ready", routine: next };
      });

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
