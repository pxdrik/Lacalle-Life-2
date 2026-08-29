import { createEntityId, entityTimestamp } from "@/core/domain/entity";

import type { Routine } from "../types/routine";
import type { PerformedSet, Session, SessionExercise } from "../types/session";

/**
 * Takes the photograph.
 *
 * Everything is copied and every id is minted fresh, so the session and the
 * routine share no reference at all. That is what makes their independence
 * structural rather than a rule someone has to remember: editing the routine
 * tomorrow has nothing in common with today's session to reach into, and
 * editing the session has nothing to reach back through.
 *
 * Each performed set carries what was planned for it, frozen here. Looking it
 * up later would read whatever the routine says *then*, which is precisely the
 * thing that must not happen.
 */
export function startSession(
  routine: Routine,
  startedAt = entityTimestamp(),
): Session {
  const exercises: SessionExercise[] = routine.exercises.map((exercise) => ({
    id: createEntityId(),
    exerciseId: exercise.exerciseId,
    name: exercise.name,
    restSeconds: exercise.restSeconds,
    notes: exercise.notes,
    sets: exercise.sets.map((set): PerformedSet => ({
      id: createEntityId(),
      // Prefilled from the plan so the common case — doing what you planned
      // — is confirming numbers rather than typing them.
      reps: set.reps,
      weightKg: set.weightKg,
      durationSeconds: set.durationSeconds,
      // RPE is left blank: it is a report on a set that has not happened yet.
      rpe: null,
      isCompleted: false,
      planned: {
        reps: set.reps,
        weightKg: set.weightKg,
        rpe: set.rpe,
        durationSeconds: set.durationSeconds,
      },
    })),
  }));

  return {
    id: createEntityId(),
    routineId: routine.id,
    name: routine.name,
    startedAt,
    finishedAt: null,
    exercises,
    createdAt: startedAt,
    updatedAt: startedAt,
  };
}
