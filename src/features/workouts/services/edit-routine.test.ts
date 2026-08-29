import { describe, expect, it } from "vitest";

import {
  createPlannedSet,
  createRoutine,
  createRoutineExercise,
  DEFAULT_SET_COUNT,
} from "./create-routine";
import {
  addExercise,
  addSet,
  moveExercise,
  removeExercise,
  removeSet,
  renameRoutine,
  updateExercise,
  updateSet,
} from "./edit-routine";

function routineWith(...names: string[]) {
  let routine = createRoutine("Treino A");
  const ids: string[] = [];

  for (const name of names) {
    const exercise = createRoutineExercise({ exerciseId: `id-${name}`, name });
    ids.push(exercise.id);
    routine = addExercise(routine, exercise);
  }

  return { routine, ids };
}

describe("createRoutine", () => {
  it("starts with no exercises", () => {
    // Unlike a diet, which gets one meal so the next click can add food, an
    // empty exercise slot is not a thing.
    expect(createRoutine("Treino A").exercises).toEqual([]);
  });

  it("trims the name", () => {
    expect(createRoutine("  Treino A  ").name).toBe("Treino A");
  });
});

describe("createRoutineExercise", () => {
  it("arrives with three sets, the usual prescription", () => {
    const exercise = createRoutineExercise({
      exerciseId: "supino",
      name: "Supino",
    });

    expect(exercise.sets).toHaveLength(DEFAULT_SET_COUNT);
  });

  it("keeps the link back to the catalogue entry", () => {
    // Load history is per exercise across months, so this reference has to
    // survive — it is what ids.lock.json protects.
    const exercise = createRoutineExercise({
      exerciseId: "supino",
      name: "Supino",
    });

    expect(exercise.exerciseId).toBe("supino");
  });

  it("copies the name, so a deleted catalogue entry leaves a readable routine", () => {
    expect(
      createRoutineExercise({ exerciseId: "supino", name: "Supino" }).name,
    ).toBe("Supino");
  });
});

describe("createPlannedSet", () => {
  it("is empty with nothing to copy", () => {
    expect(createPlannedSet()).toMatchObject({
      reps: null,
      weightKg: null,
      rpe: null,
    });
  });

  it("copies the previous set", () => {
    // Sets within an exercise are usually the same; retyping 8 × 60 kg three
    // times is work the app can do.
    const previous = {
      id: "a",
      reps: 8,
      weightKg: 60,
      rpe: 8,
      durationSeconds: null,
    };

    expect(createPlannedSet(previous)).toMatchObject({
      reps: 8,
      weightKg: 60,
      rpe: 8,
    });
  });

  it("still gets its own id", () => {
    const previous = {
      id: "a",
      reps: 8,
      weightKg: 60,
      rpe: 8,
      durationSeconds: null,
    };

    expect(createPlannedSet(previous).id).not.toBe("a");
  });
});

describe("exercises", () => {
  it("appends", () => {
    expect(routineWith("Supino", "Remada").routine.exercises).toHaveLength(2);
  });

  it("removes", () => {
    const { routine, ids } = routineWith("Supino", "Remada");

    expect(removeExercise(routine, ids[0]!).exercises).toHaveLength(1);
  });

  it("updates rest without touching the others", () => {
    const { routine, ids } = routineWith("Supino", "Remada");
    const updated = updateExercise(routine, ids[0]!, { restSeconds: 120 });

    expect(updated.exercises[0]?.restSeconds).toBe(120);
    expect(updated.exercises[1]?.restSeconds).toBeNull();
  });
});

describe("sets", () => {
  it("adds one, copying the last", () => {
    const { routine, ids } = routineWith("Supino");
    const withValues = updateSet(
      routine,
      ids[0]!,
      routine.exercises[0]!.sets[2]!.id,
      { reps: 8, weightKg: 60 },
    );

    const added = addSet(withValues, ids[0]!);
    const sets = added.exercises[0]!.sets;

    expect(sets).toHaveLength(4);
    expect(sets[3]).toMatchObject({ reps: 8, weightKg: 60 });
  });

  it("removes one", () => {
    const { routine, ids } = routineWith("Supino");
    const setId = routine.exercises[0]!.sets[0]!.id;

    expect(removeSet(routine, ids[0]!, setId).exercises[0]?.sets).toHaveLength(
      2,
    );
  });

  it("updates reps, weight and RPE independently", () => {
    const { routine, ids } = routineWith("Supino");
    const setId = routine.exercises[0]!.sets[0]!.id;

    const updated = updateSet(routine, ids[0]!, setId, { rpe: 8 });

    expect(updated.exercises[0]?.sets[0]).toMatchObject({
      reps: null,
      weightKg: null,
      rpe: 8,
    });
  });

  it("accepts a set with no RPE, because RPE is never required", () => {
    const { routine, ids } = routineWith("Supino");
    const setId = routine.exercises[0]!.sets[0]!.id;

    const updated = updateSet(routine, ids[0]!, setId, {
      reps: 8,
      weightKg: 60,
    });

    expect(updated.exercises[0]?.sets[0]?.rpe).toBeNull();
  });
});

describe("moveExercise", () => {
  it("moves down", () => {
    const { routine, ids } = routineWith("Supino", "Remada", "Rosca");
    const moved = moveExercise(routine, ids[0]!, 1);

    expect(moved.exercises.map((e) => e.name)).toEqual([
      "Remada",
      "Supino",
      "Rosca",
    ]);
  });

  it("moves up", () => {
    const { routine, ids } = routineWith("Supino", "Remada", "Rosca");
    const moved = moveExercise(routine, ids[2]!, -1);

    expect(moved.exercises.map((e) => e.name)).toEqual([
      "Supino",
      "Rosca",
      "Remada",
    ]);
  });

  it("is a no-op at the edges", () => {
    const { routine, ids } = routineWith("Supino", "Remada");

    expect(moveExercise(routine, ids[0]!, -1)).toBe(routine);
    expect(moveExercise(routine, ids[1]!, 1)).toBe(routine);
  });
});

describe("stale references", () => {
  // The UI addresses things by id and can be a frame behind the data, so a
  // click on something already gone must be a no-op rather than a crash.
  it("ignores an unknown exercise and reports no write", () => {
    const { routine } = routineWith("Supino");

    expect(updateExercise(routine, "gone", { restSeconds: 60 })).toBe(routine);
    expect(addSet(routine, "gone")).toBe(routine);
    expect(moveExercise(routine, "gone", 1)).toBe(routine);
  });

  it("ignores an unknown set", () => {
    const { routine, ids } = routineWith("Supino");
    const after = updateSet(routine, ids[0]!, "gone", { reps: 99 });

    expect(after.exercises[0]?.sets.every((s) => s.reps === null)).toBe(true);
  });
});

describe("immutability", () => {
  it("never mutates the routine it was given", () => {
    const { routine, ids } = routineWith("Supino", "Remada");
    const snapshot = structuredClone(routine);

    renameRoutine(routine, "Outro");
    addSet(routine, ids[0]!);
    removeExercise(routine, ids[0]!);
    moveExercise(routine, ids[0]!, 1);

    expect(routine).toEqual(snapshot);
  });
});
