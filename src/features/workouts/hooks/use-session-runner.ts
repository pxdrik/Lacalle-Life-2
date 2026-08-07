"use client";

import { useCallback, useEffect, useState } from "react";

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

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const session = await (await repositories).sessions.getById(sessionId);
        if (!active) return;
        setState(
          session === undefined ? { status: "missing" } : { status: "ready", session },
        );
      } catch (cause) {
        if (active) setState({ status: "error", message: describeDataError(cause) });
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [repositories, sessionId]);

  const apply = useCallback(
    (change: (session: Session) => Session) => {
      if (state.status !== "ready") return;

      const next = change(state.session);
      if (next === state.session) return;

      setState({ status: "ready", session: next });
      void persist(next);

      async function persist(session: Session) {
        setSaveError(null);
        try {
          await (await repositories).sessions.save(session);
        } catch (cause) {
          setSaveError(describeDataError(cause));
        }
      }
    },
    // Reads `state`, so it changes identity per edit. That is what keeps the
    // side effect out of the state updater, which React may run twice.
    [state, repositories],
  );

  return { state, saveError, apply };
}
