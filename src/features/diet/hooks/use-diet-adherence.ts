"use client";

import { useEffect, useState } from "react";

import { dayKey } from "@/core/format/day";
import { describeDataError } from "@/core/domain/describe-data-error";

import { useDietRepository } from "../data/diet-repository-context";
import { useFoodLogRepository } from "../data/food-log-repository-context";
import { ADHERENCE_WEEKS } from "../services/diet-adherence";
import type { Diet } from "../types/diet";
import type { FoodLog } from "../types/food-log";

export type DietAdherenceState =
  | { readonly status: "loading" }
  | {
      readonly status: "ready";
      readonly diets: readonly Diet[];
      readonly logs: readonly FoodLog[];
    }
  | { readonly status: "error"; readonly message: string };

const DAY_MS = 24 * 60 * 60 * 1000;
// Same +6-day slack `adherenceByWeek` itself allows for, so the range this
// hook reads always covers everything that function will walk.
const WINDOW_DAYS = ADHERENCE_WEEKS * 7 + 6;

/**
 * Every diet, and every day's log inside the adherence window, read once.
 *
 * Two reads rather than one because they come from different repositories —
 * `adherenceByWeek` is what actually joins them, in memory, the same way
 * `useSessionHistory` (workouts) reads everything once and lets pure
 * functions derive volume, records and trails from it.
 *
 * `now` has no default here on purpose: a hook's own default parameter
 * calling `Date.now()` reads as impure to the React Compiler even though a
 * component reading the clock directly in its body does not (`diet-editor.tsx`
 * does exactly that for "today"). The caller reads the clock; this hook
 * only uses what it is given.
 */
export function useDietAdherence(now: number): DietAdherenceState {
  const dietRepository = useDietRepository();
  const foodLogRepository = useFoodLogRepository();
  const [state, setState] = useState<DietAdherenceState>({
    status: "loading",
  });

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const from = dayKey(new Date(now - WINDOW_DAYS * DAY_MS));
        const to = dayKey(new Date(now));

        const [diets, logs] = await Promise.all([
          (await dietRepository).listAll(),
          (await foodLogRepository).listBetween(from, to),
        ]);
        if (!active) return;

        setState({ status: "ready", diets, logs });
      } catch (cause) {
        if (active)
          setState({ status: "error", message: describeDataError(cause) });
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [dietRepository, foodLogRepository, now]);

  return state;
}
