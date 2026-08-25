"use client";

import { useCallback, useEffect, useState } from "react";

import { DataError } from "@/core/domain/data-error";
import { describeDataError } from "@/core/domain/describe-data-error";
import {
  buildNutritionPlan,
  type NutritionProfile,
  type PlanResult,
} from "@/core/nutrition";

import { useProfileRepository } from "../data/profile-repository-context";
import { PROFILE_ID, type Profile } from "../types/profile";

export type ProfileState =
  | { readonly status: "loading" }
  /** No profile yet. Targets are off, and everything else works unchanged. */
  | { readonly status: "empty" }
  | {
      readonly status: "ready";
      readonly profile: Profile;
      readonly result: PlanResult;
    }
  | { readonly status: "error"; readonly message: string };

export interface ProfileStore {
  readonly state: ProfileState;
  readonly writeError: string | null;
  /** `true` specifically for `DataError("CONFLICT")` — see `reload`. */
  readonly hasConflict: boolean;
  readonly save: (nutrition: NutritionProfile) => Promise<boolean>;
  readonly clear: () => Promise<void>;
  /**
   * Re-reads the profile from storage and clears `writeError`.
   *
   * The one way out of a conflict: two tabs editing the profile at once used
   * to mean the second save silently discarded the first tab's edit. Now the
   * second save is rejected instead — correct, but it left whichever tab lost
   * stuck re-submitting the same stale version forever, since nothing ever
   * told it what the *current* version actually is. This is that "tell it" —
   * the caller decides when to give up the local edit and see what is
   * actually stored, rather than it happening silently on their behalf.
   */
  readonly reload: () => void;
}

/**
 * Loads the profile and derives its plan.
 *
 * The plan is computed on read rather than stored. Storing it would create a
 * second source of truth that goes stale the moment a constant in the engine
 * changes — and recomputing costs microseconds.
 */
export function useProfile(): ProfileStore {
  const repository = useProfileRepository();
  const [state, setState] = useState<ProfileState>({ status: "loading" });
  const [writeError, setWriteError] = useState<string | null>(null);
  const [hasConflict, setHasConflict] = useState(false);

  /**
   * Bumped by `reload` to re-run the effect below. Kept as a token the effect
   * depends on, rather than an extracted function called from inside it: the
   * latter is exactly the shape `react-hooks/set-state-in-effect` flags, even
   * though the write only ever happens after the `await`.
   */
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const profile = await (await repository).get();
        if (!active) return;
        setState(profile === undefined ? { status: "empty" } : ready(profile));
      } catch (error) {
        if (active) {
          setState({ status: "error", message: describeDataError(error) });
        }
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [repository, reloadToken]);

  const save = useCallback(
    async (nutrition: NutritionProfile): Promise<boolean> => {
      setWriteError(null);
      setHasConflict(false);
      const now = Date.now();

      // `createdAt` is preserved across edits so a first-filled date survives.
      const profile: Profile = {
        id: PROFILE_ID,
        nutrition,
        createdAt: state.status === "ready" ? state.profile.createdAt : now,
        updatedAt: now,
      };
      const expectedUpdatedAt =
        state.status === "ready" ? state.profile.updatedAt : null;

      try {
        await (await repository).save(profile, expectedUpdatedAt);
        setState(ready(profile));
        return true;
      } catch (error) {
        setWriteError(describeDataError(error));
        setHasConflict(error instanceof DataError && error.code === "CONFLICT");
        return false;
      }
    },
    [repository, state],
  );

  const clear = useCallback(async () => {
    setWriteError(null);
    setHasConflict(false);

    try {
      await (await repository).clear();
      setState({ status: "empty" });
    } catch (error) {
      setWriteError(describeDataError(error));
    }
  }, [repository]);

  const reload = useCallback(() => {
    setWriteError(null);
    setHasConflict(false);
    setState({ status: "loading" });
    setReloadToken((token) => token + 1);
  }, []);

  return { state, writeError, hasConflict, save, clear, reload };
}

function ready(profile: Profile): ProfileState {
  return {
    status: "ready",
    profile,
    result: buildNutritionPlan(profile.nutrition),
  };
}
