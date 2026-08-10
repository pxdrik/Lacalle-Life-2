import { describe, expect, it } from "vitest";

import { createRoutine, createRoutineExercise } from "./create-routine";
import {
  addExercise,
  removeExercise,
  renameRoutine,
  updateSet,
} from "./edit-routine";
import { startSession } from "./start-session";

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

  return { routine, exerciseId: supino.id };
}

describe("startSession", () => {
  it("copies the routine's name and records where it came from", () => {
    const { routine } = plannedRoutine();
    const session = startSession(routine);

    expect(session.name).toBe("Treino A");
    expect(session.routineId).toBe(routine.id);
  });

  it("starts unfinished", () => {
    expect(startSession(plannedRoutine().routine).finishedAt).toBeNull();
  });

  it("carries every exercise and set across", () => {
    const session = startSession(plannedRoutine().routine);

    expect(session.exercises).toHaveLength(1);
    expect(session.exercises[0]?.sets).toHaveLength(3);
  });

  it("keeps the link to the catalogue entry", () => {
    const session = startSession(plannedRoutine().routine);

    expect(session.exercises[0]?.exerciseId).toBe("supino-reto-barra");
  });

  describe("prefilling", () => {
    it("carries planned reps and weight into the performed set", () => {
      // Doing what you planned should be confirming numbers, not typing them.
      const session = startSession(plannedRoutine().routine);

      expect(session.exercises[0]?.sets[0]).toMatchObject({
        reps: 8,
        weightKg: 60,
        isCompleted: false,
      });
    });

    it("leaves performed RPE blank", () => {
      // It is a report on a set that has not happened yet.
      const session = startSession(plannedRoutine().routine);

      expect(session.exercises[0]?.sets[0]?.rpe).toBeNull();
    });

    it("freezes what was planned, including the target RPE", () => {
      const session = startSession(plannedRoutine().routine);

      expect(session.exercises[0]?.sets[0]?.planned).toEqual({
        reps: 8,
        weightKg: 60,
        rpe: 8,
      });
    });
  });
});

describe("independence", () => {
  /**
   * The property the whole two-aggregate design exists for: a session is a
   * photograph, and photographs do not change when the subject does.
   */
  it("shares no id with the routine it came from", () => {
    const { routine } = plannedRoutine();
    const session = startSession(routine);

    const routineIds = new Set([
      routine.id,
      ...routine.exercises.map((e) => e.id),
      ...routine.exercises.flatMap((e) => e.sets.map((s) => s.id)),
    ]);
    const sessionIds = [
      session.id,
      ...session.exercises.map((e) => e.id),
      ...session.exercises.flatMap((e) => e.sets.map((s) => s.id)),
    ];

    // No shared reference means no path for a mutation to travel along.
    expect(sessionIds.filter((id) => routineIds.has(id))).toEqual([]);
  });

  it("does not change when the routine is edited afterwards", () => {
    const { routine, exerciseId } = plannedRoutine();
    const session = startSession(routine);
    const before = structuredClone(session);

    let later = renameRoutine(routine, "Treino A v2");
    later = updateSet(later, exerciseId, routine.exercises[0]!.sets[0]!.id, {
      reps: 12,
      weightKg: 100,
      rpe: 10,
    });
    later = removeExercise(later, exerciseId);

    // Asserted first, so the test cannot pass by the edits having been no-ops
    // against an id that no longer matched.
    expect(later.name).toBe("Treino A v2");
    expect(later.exercises).toEqual([]);

    expect(session).toEqual(before);
  });

  it("does not change the routine when the session is edited", () => {
    const { routine } = plannedRoutine();
    const before = structuredClone(routine);

    const session = startSession(routine);
    // Stand-in for what the execution screen does to a set.
    const edited = {
      ...session,
      exercises: session.exercises.map((exercise) => ({
        ...exercise,
        sets: exercise.sets.map((set) => ({
          ...set,
          reps: 99,
          isCompleted: true,
        })),
      })),
    };

    expect(edited.exercises[0]?.sets[0]?.reps).toBe(99);
    expect(routine).toEqual(before);
  });

  it("gives two sessions from one routine nothing in common", () => {
    const { routine } = plannedRoutine();
    const monday = startSession(routine, 1_000);
    const friday = startSession(routine, 2_000);

    expect(monday.id).not.toBe(friday.id);
    expect(monday.exercises[0]?.id).not.toBe(friday.exercises[0]?.id);
    expect(monday.startedAt).toBe(1_000);
    expect(friday.startedAt).toBe(2_000);
  });
});

describe("an unplanned routine", () => {
  it("starts a session with no exercises rather than refusing", () => {
    const session = startSession(createRoutine("Treino livre"));

    expect(session.exercises).toEqual([]);
    expect(session.finishedAt).toBeNull();
  });
});
