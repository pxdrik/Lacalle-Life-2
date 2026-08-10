import { describe, expect, it } from "vitest";

import {
  createRoutine,
  createRoutineExercise,
  duplicateRoutine,
  duplicateRoutineExercise,
} from "./create-routine";
import { addExercise, updateSet } from "./edit-routine";
import { startSession } from "./start-session";
import type { Routine } from "../types/routine";

function plannedRoutine() {
  let routine = createRoutine("Treino A");

  const supino = createRoutineExercise({
    exerciseId: "supino-reto-barra",
    name: "Supino Reto com Barra",
  });
  routine = addExercise(routine, supino);
  for (const set of supino.sets) {
    routine = updateSet(routine, supino.id, set.id, {
      reps: 8,
      weightKg: 60,
      rpe: 8,
    });
  }

  const remada = createRoutineExercise({
    exerciseId: "remada-curvada-barra",
    name: "Remada Curvada com Barra",
  });
  routine = addExercise(routine, remada);

  return { routine, supinoId: supino.id };
}

/** Every id in a routine, at every level. */
function allIds(routine: Routine): string[] {
  return [
    routine.id,
    ...routine.exercises.flatMap((exercise) => [
      exercise.id,
      ...exercise.sets.map((set) => set.id),
    ]),
  ];
}

describe("duplicateRoutine", () => {
  it("copies the exercises and their sets", () => {
    const { routine } = plannedRoutine();
    const copy = duplicateRoutine(routine);

    expect(copy.exercises.map((e) => e.name)).toEqual([
      "Supino Reto com Barra",
      "Remada Curvada com Barra",
    ]);
    expect(copy.exercises[0]?.sets).toHaveLength(3);
  });

  it("marks the copy in its name, since it sits beside the original", () => {
    const { routine } = plannedRoutine();

    expect(duplicateRoutine(routine).name).toBe("Treino A (cópia)");
  });

  it("shares no id with the original, at any level", () => {
    const { routine } = plannedRoutine();
    const copy = duplicateRoutine(routine);

    const original = new Set(allIds(routine));
    expect(allIds(copy).filter((id) => original.has(id))).toEqual([]);
  });

  it("keeps the link to the catalogue, which is a reference and not identity", () => {
    // exerciseId points at the catalogue entry and must survive the copy —
    // it is what ties load history together across routines.
    const { routine } = plannedRoutine();
    const copy = duplicateRoutine(routine);

    expect(copy.exercises[0]?.exerciseId).toBe("supino-reto-barra");
  });

  it("carries the planned numbers across", () => {
    const { routine } = plannedRoutine();

    expect(duplicateRoutine(routine).exercises[0]?.sets[0]).toMatchObject({
      reps: 8,
      weightKg: 60,
      rpe: 8,
    });
  });

  it("does not change when the original is edited afterwards", () => {
    const { routine, supinoId } = plannedRoutine();
    const copy = duplicateRoutine(routine);
    const before = structuredClone(copy);

    const setId = routine.exercises[0]!.sets[0]!.id;
    const later = updateSet(routine, supinoId, setId, {
      reps: 20,
      weightKg: 200,
    });

    expect(later.exercises[0]?.sets[0]?.reps).toBe(20);
    expect(copy).toEqual(before);
  });

  it("starts sessions that are independent of the original's", () => {
    const { routine } = plannedRoutine();
    const copy = duplicateRoutine(routine);

    const fromOriginal = startSession(routine, 1_000);
    const fromCopy = startSession(copy, 2_000);

    expect(fromOriginal.routineId).toBe(routine.id);
    expect(fromCopy.routineId).toBe(copy.id);
    expect(fromOriginal.routineId).not.toBe(fromCopy.routineId);
  });
});

describe("duplicateRoutineExercise", () => {
  it("inserts the copy directly below the original", () => {
    const { routine, supinoId } = plannedRoutine();
    const after = duplicateRoutineExercise(routine, supinoId);

    expect(after.exercises.map((e) => e.name)).toEqual([
      "Supino Reto com Barra",
      "Supino Reto com Barra",
      "Remada Curvada com Barra",
    ]);
  });

  it("leaves the name alone, unlike a duplicated routine", () => {
    // Duplicating an exercise is usually how a drop set or a second variation
    // gets added; a "(cópia)" to delete first would be work, not help.
    const { routine, supinoId } = plannedRoutine();

    expect(duplicateRoutineExercise(routine, supinoId).exercises[1]?.name).toBe(
      "Supino Reto com Barra",
    );
  });

  it("gives the copied sets fresh ids", () => {
    const { routine, supinoId } = plannedRoutine();
    const after = duplicateRoutineExercise(routine, supinoId);

    const originalSets = after.exercises[0]!.sets.map((s) => s.id);
    const copiedSets = after.exercises[1]!.sets.map((s) => s.id);

    expect(copiedSets).toHaveLength(3);
    expect(copiedSets.filter((id) => originalSets.includes(id))).toEqual([]);
  });

  it("carries the planned numbers, which is the point of duplicating", () => {
    const { routine, supinoId } = plannedRoutine();
    const after = duplicateRoutineExercise(routine, supinoId);

    expect(after.exercises[1]?.sets[0]).toMatchObject({
      reps: 8,
      weightKg: 60,
      rpe: 8,
    });
  });

  it("ignores an exercise that is no longer there", () => {
    const { routine } = plannedRoutine();

    expect(duplicateRoutineExercise(routine, "gone")).toBe(routine);
  });
});
