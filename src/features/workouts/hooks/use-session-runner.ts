"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { describeDataError } from "@/core/domain/describe-data-error";
import type { EntityId } from "@/core/domain/entity";

import { useWorkoutRepositories } from "../data/workout-repository-context";
import type { Session } from "../types/session";

export type SessionRunnerState =
  | { readonly status: "loading" }
  | { readonly status: "missing" }
  | { readonly status: "ready"; readonly session: Session }
  | { readonly status: "error"; readonly message: string };

export interface SessionRunner {
  readonly state: SessionRunnerState;
  readonly saveError: string | null;
  readonly apply: (change: (session: Session) => Session) => void;
  /** Resolves `true` once the session is gone, so the caller can navigate. */
  readonly remove: () => Promise<boolean>;
}

/**
 * Loads one session and persists every change to it.
 *
 * Writes go out immediately, with no debounce, and that matters more here than
 * anywhere else in the app: a phone in a gym gets locked, dropped, and killed
 * by the OS mid-workout. Anything not written when the set was marked is
 * anything lost.
 */
export function useSessionRunner(sessionId: EntityId): SessionRunner {
  const repositories = useWorkoutRepositories();
  const [state, setState] = useState<SessionRunnerState>({ status: "loading" });
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
        const session = await (await repositories).sessions.getById(sessionId);
        if (!active) return;
        const next: SessionRunnerState =
          session === undefined
            ? { status: "missing" }
            : { status: "ready", session };
        stateRef.current = next;
        setState(next);
      } catch (cause) {
        if (active) {
          const next: SessionRunnerState = {
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
  }, [repositories, sessionId]);

  /**
   * Reads and writes `stateRef` rather than using the functional form of
   * `setState`, on purpose — that used to be `setState((prevState) => {
   * ...; void persist(...); return next; })`, and it produced a real,
   * reproducible bug: the function passed to `setState` is a *render-phase*
   * function, and React Strict Mode (`reactStrictMode: true` in
   * `next.config.ts`) deliberately invokes it twice to catch exactly this —
   * an impure updater with a side effect inside it. Both invocations read the
   * same `prevState.session.updatedAt` and both called `persist`, so one
   * completed set or one "Finalizar" fired two writes racing on the same
   * expected version; the second always lost, surfacing as "Isso foi
   * alterado em outro lugar" from a single tap on a single tab. `apply`
   * itself is an ordinary callback, not a render function, so React never
   * double-invokes it — the ref gives it the same "read the version this
   * edit actually grew out of" guarantee the old comment described, without
   * living inside a function React is allowed to call twice.
   */
  const apply = useCallback(
    (change: (session: Session) => Session) => {
      const prevState = stateRef.current;
      if (prevState.status !== "ready") return;

      const next = change(prevState.session);
      if (next === prevState.session) return;

      const nextState: SessionRunnerState = { status: "ready", session: next };
      stateRef.current = nextState;
      setState(nextState);

      void persist(next, prevState.session.updatedAt);

      async function persist(session: Session, expectedUpdatedAt: number) {
        setSaveError(null);
        try {
          await (await repositories).sessions.save(session, expectedUpdatedAt);
        } catch (cause) {
          setSaveError(describeDataError(cause));
        }
      }
    },
    [repositories],
  );

  const remove = useCallback(async (): Promise<boolean> => {
    setSaveError(null);

    try {
      // The routine is untouched. Deleting a workout that happened does not
      // delete the plan it came from.
      await (await repositories).sessions.remove(sessionId);
      return true;
    } catch (cause) {
      setSaveError(describeDataError(cause));
      return false;
    }
  }, [repositories, sessionId]);

  return { state, saveError, apply, remove };
}
