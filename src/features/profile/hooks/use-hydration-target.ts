"use client";

import { useEffect, useState } from "react";

import { computeHydrationTargetMl } from "@/core/nutrition";

import { useOptionalProfileRepository } from "../data/profile-repository-context";

/**
 * The daily water target in mL, or `null` when there is none.
 *
 * Same three-way `null` as `useNutritionTargets` — no profile feature wired
 * in, no profile filled in, or a read that failed — and a caller never has
 * to tell them apart. Unlike calorie/macro targets, there is no engine
 * refusal case here: any positive weight produces a target.
 */
export function useHydrationTarget(): number | null {
  const repository = useOptionalProfileRepository();
  const [target, setTarget] = useState<number | null>(null);

  useEffect(() => {
    if (repository === null) return;

    const source = repository;
    let active = true;

    async function load() {
      try {
        const profile = await (await source).get();
        if (!active || profile === undefined) return;

        setTarget(computeHydrationTargetMl(profile.nutrition.weightKg));
      } catch {
        // Stays null. See above.
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [repository]);

  return target;
}
