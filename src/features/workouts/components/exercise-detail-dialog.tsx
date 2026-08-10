"use client";

import { useState } from "react";

import { Dialog } from "@/design-system/components/dialog";

import type { Exercise } from "../types/exercise";
import { ExerciseDetail } from "./exercise-detail";

export interface ExerciseDetailControl {
  readonly exercise: Exercise | null;
  readonly open: boolean;
  readonly show: (exercise: Exercise) => void;
  readonly hide: () => void;
}

/**
 * Opening and closing the detail, kept apart from *which* exercise it shows.
 *
 * Two pieces of state rather than one nullable, because clearing the exercise
 * on close would empty the dialog while it is still fading out — the content
 * would vanish and an empty box would animate away. Keeping the last exercise
 * mounted until the next one replaces it costs one boolean.
 *
 * Lives here so the three screens that open this dialog share the behaviour
 * instead of each inventing it.
 */
export function useExerciseDetail(): ExerciseDetailControl {
  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [open, setOpen] = useState(false);

  return {
    exercise,
    open,
    show: (next: Exercise) => {
      setExercise(next);
      setOpen(true);
    },
    hide: () => {
      setOpen(false);
    },
  };
}

export function ExerciseDetailDialog({
  control,
}: {
  readonly control: ExerciseDetailControl;
}) {
  const { exercise, open, hide } = control;

  return (
    <Dialog open={open} title={exercise?.name ?? ""} onClose={hide}>
      {exercise !== null && <ExerciseDetail exercise={exercise} />}
    </Dialog>
  );
}
