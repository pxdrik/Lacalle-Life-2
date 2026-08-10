"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { describeDataError } from "@/core/domain/describe-data-error";
import { revise } from "@/core/domain/entity";

import { useExerciseRepository } from "../data/exercise-repository-context";
import { createCustomExercise } from "../services/create-exercise";
import {
  buildExerciseIndex,
  type ExerciseIndex,
} from "../services/search-exercises";
import type { Exercise } from "../types/exercise";
import type { CustomExerciseInput } from "../validation/custom-exercise-schema";

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
  /**
   * Creates a user's own exercise and puts it into the list immediately.
   *
   * Resolves to the exercise so the caller can use it at once — the whole
   * point is that "not in the catalogue" never becomes a dead end mid-routine.
   */
  readonly createExercise: (
    input: CustomExerciseInput,
  ) => Promise<Exercise | null>;
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

  const createExercise = useCallback(
    async (input: CustomExerciseInput): Promise<Exercise | null> => {
      setWriteError(null);
      const exercise = createCustomExercise(input);

      try {
        await (await repository).save(exercise);
        // Inserted locally rather than re-read: the list is already sorted and
        // a full reload would cost a round trip for one row.
        setExercises((current) =>
          current === null
            ? [exercise]
            : [...current, exercise].sort((a, b) =>
                collator.compare(a.name, b.name),
              ),
        );
        return exercise;
      } catch (cause) {
        setWriteError(describeDataError(cause));
        return null;
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

  return { state, writeError, toggleFavorite, createExercise };
}

/** Same collation the repository sorts by, so a new row lands where it belongs. */
const collator = new Intl.Collator("pt-BR", { sensitivity: "base" });
