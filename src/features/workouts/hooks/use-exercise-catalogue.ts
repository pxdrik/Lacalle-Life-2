"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { describeDataError } from "@/core/domain/describe-data-error";
import { revise } from "@/core/domain/entity";

import { useExerciseRepository } from "../data/exercise-repository-context";
import {
  buildExerciseIndex,
  type ExerciseIndex,
} from "../services/search-exercises";
import type { Exercise } from "../types/exercise";

export type ExerciseCatalogueState =
  | { readonly status: "loading" }
  | {
      readonly status: "ready";
      readonly exercises: readonly Exercise[];
      readonly index: ExerciseIndex;
    }
  | { readonly status: "error"; readonly message: string };

export interface ExerciseCatalogue {
  readonly state: ExerciseCatalogueState;
  readonly writeError: string | null;
  readonly toggleFavorite: (exercise: Exercise) => Promise<void>;
}

/**
 * Loads the whole catalogue once and prepares its search index.
 *
 * All of it, deliberately: a few hundred rows is a single read, and holding
 * them in memory is what lets search and filters run without touching storage
 * again — no debounce, no per-keystroke query, no spinner.
 *
 * The index is rebuilt only when the list identity changes, so a favourite
 * toggle costs one rebuild rather than one per keystroke.
 */
export function useExerciseCatalogue(): ExerciseCatalogue {
  const repository = useExerciseRepository();
  const [exercises, setExercises] = useState<readonly Exercise[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [writeError, setWriteError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const all = await (await repository).listAll();
        if (active) setExercises(all);
      } catch (cause) {
        if (active) setError(describeDataError(cause));
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [repository]);

  const index = useMemo(
    () => (exercises === null ? null : buildExerciseIndex(exercises)),
    [exercises],
  );

  const toggleFavorite = useCallback(
    async (exercise: Exercise) => {
      setWriteError(null);
      const updated = revise(exercise, { isFavorite: !exercise.isFavorite });

      try {
        await (await repository).save(updated);
        setExercises((current) =>
          current === null
            ? current
            : current.map((item) => (item.id === updated.id ? updated : item)),
        );
      } catch (cause) {
        setWriteError(describeDataError(cause));
      }
    },
    [repository],
  );

  const state: ExerciseCatalogueState =
    error !== null
      ? { status: "error", message: error }
      : exercises === null || index === null
        ? { status: "loading" }
        : { status: "ready", exercises, index };

  return { state, writeError, toggleFavorite };
}
