"use client";

import { useEffect, useState } from "react";

import type { Macros } from "@/core/domain/macros";
import { buildNutritionPlan } from "@/core/nutrition";

import { useOptionalProfileRepository } from "../data/profile-repository-context";

/**
 * The daily targets, or `null` when there are none.
 *
 * `null` is the normal case, not an error. It covers all three ways there can
 * be no targets, and a caller never has to tell them apart:
 *   - the profile feature is not even wired into this screen;
 *   - it is, but no profile has been filled in;
 *   - a profile exists but the engine refused it as unsafe.
 *
 * A failed read also yields `null` — a screen about diets should not surface a
 * storage error about a profile the user never filled in.
 */
export function useNutritionTargets(): Macros | null {
  const repository = useOptionalProfileRepository();
  const [targets, setTargets] = useState<Macros | null>(null);

  useEffect(() => {
    if (repository === null) return;

    // Captured locally: TypeScript will not carry the null check into a
    // nested function declaration.
    const source = repository;
    let active = true;

    async function load() {
      try {
        const profile = await (await source).get();
        if (!active || profile === undefined) return;

        const result = buildNutritionPlan(profile.nutrition);
        if (result.ok) setTargets(result.plan.targets);
      } catch {
        // Stays null. See above.
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [repository]);

  return targets;
}
