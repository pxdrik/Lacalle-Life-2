"use client";

import { useEffect, useState } from "react";

import { describeDataError } from "@/core/domain/describe-data-error";

import { useWorkoutRepositories } from "../data/workout-repository-context";
import type { Session } from "../types/session";

export type SessionHistoryState =
  | { readonly status: "loading" }
  | {
      readonly status: "ready";
      /** Every session, newest first, finished or not. */
      readonly sessions: readonly Session[];
      /** The workout left open, if there is one. */
      readonly inProgress: Session | undefined;
    }
  | { readonly status: "error"; readonly message: string };

/**
 * All sessions, read once.
 *
 * Everything the history screens show — last performance, records, volume — is
 * derived from this in memory rather than from precomputed tables. One source
 * of truth, and fast enough: a session is around 1.5 KB, so five years of
 * training is a couple of megabytes read once per screen.
 *
 * The day that stops being true, a derived index rebuilt on write replaces
 * this hook's body and nothing above it changes.
 */
export function useSessionHistory(): SessionHistoryState {
  const repositories = useWorkoutRepositories();
  const [state, setState] = useState<SessionHistoryState>({
    status: "loading",
  });

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const sessions = await (await repositories).sessions.listAll();
        if (!active) return;

        setState({
          status: "ready",
          sessions,
          inProgress: sessions.find((session) => session.finishedAt === null),
        });
      } catch (cause) {
        if (active)
          setState({ status: "error", message: describeDataError(cause) });
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [repositories]);

  return state;
}
