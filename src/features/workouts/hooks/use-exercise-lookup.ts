"use client";

import { useEffect, useMemo, useState } from "react";

import type { EntityId } from "@/core/domain/entity";

import { useExerciseRepository } from "../data/exercise-repository-context";
import type { Exercise } from "../types/exercise";

/**
 * The catalogue indexed by id, for screens that need to resolve an exercise
 * rather than search for one.
 *
 * Separate from `useExerciseCatalogue` on purpose. That hook exists to search,
 * filter and favourite; it builds a prepared search index and rebuilds it
 * whenever the list changes. A routine card asking "what does this exercise
 * look like" needs none of that.
 *
 * **This is what keeps photos out of `Routine` and `Session`.** Those hold a
 * copy of the exercise's name — so renaming an exercise never rewrites what
 * was lifted last March — but keep `exerciseId` as a live reference. The photo
 * follows the reference, which means correcting a wrong photo tomorrow fixes
 * it everywhere instead of in new routines only.
 *
 * Failure is silent by design: a missing photo is not worth an error banner
 * over someone's workout. Callers get an empty map and render exactly what
 * they rendered before photos existed.
 */
export function useExerciseLookup(): ReadonlyMap<EntityId, Exercise> {
  const repository = useExerciseRepository();
  const [exercises, setExercises] = useState<readonly Exercise[]>([]);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const all = await (await repository).listAll();
        if (active) setExercises(all);
      } catch {
        // Left empty: see above.
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [repository]);

  return useMemo(
    () => new Map(exercises.map((exercise) => [exercise.id, exercise])),
    [exercises],
  );
}
