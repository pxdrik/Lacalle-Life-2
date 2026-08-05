"use client";

import { useCallback, useEffect, useState } from "react";

import { describeDataError } from "@/core/domain/describe-data-error";
import { buildNutritionPlan, type NutritionProfile, type PlanResult } from "@/core/nutrition";

import { useProfileRepository } from "../data/profile-repository-context";
import { PROFILE_ID, type Profile } from "../types/profile";

export type ProfileState =
  | { readonly status: "loading" }
  /** No profile yet. Targets are off, and everything else works unchanged. */
  | { readonly status: "empty" }
  | { readonly status: "ready"; readonly profile: Profile; readonly result: PlanResult }
  | { readonly status: "error"; readonly message: string };

export interface ProfileStore {
  readonly state: ProfileState;
  readonly writeError: string | null;
  readonly save: (nutrition: NutritionProfile) => Promise<boolean>;
  readonly clear: () => Promise<void>;
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

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const profile = await (await repository).get();
        if (!active) return;
        setState(profile === undefined ? { status: "empty" } : ready(profile));
      } catch (error) {
        if (active) setState({ status: "error", message: describeDataError(error) });
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [repository]);

  const save = useCallback(
    async (nutrition: NutritionProfile): Promise<boolean> => {
      setWriteError(null);
      const now = Date.now();

      // `createdAt` is preserved across edits so a first-filled date survives.
      const profile: Profile = {
        id: PROFILE_ID,
        nutrition,
        createdAt: state.status === "ready" ? state.profile.createdAt : now,
        updatedAt: now,
      };

      try {
        await (await repository).save(profile);
        setState(ready(profile));
        return true;
      } catch (error) {
        setWriteError(describeDataError(error));
        return false;
      }
    },
    [repository, state],
  );

  const clear = useCallback(async () => {
    setWriteError(null);

    try {
      await (await repository).clear();
      setState({ status: "empty" });
    } catch (error) {
      setWriteError(describeDataError(error));
    }
  }, [repository]);

  return { state, writeError, save, clear };
}

function ready(profile: Profile): ProfileState {
  return {
    status: "ready",
    profile,
    result: buildNutritionPlan(profile.nutrition),
  };
}
