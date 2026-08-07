import { describe, expect, it } from "vitest";

import { createRoutine, createRoutineExercise } from "./create-routine";
import { addExercise, updateExercise, updateSet } from "./edit-routine";
import {
  addPerformedSet,
  completeSet,
  finishSession,
  moveSessionToDay,
  removePerformedSet,
  reopenSession,
  setSessionExerciseNotes,
  uncompleteSet,
  updatePerformedSet,
} from "./edit-session";
import {
  comparePlanned,
  formatDuration,
  nextIncompleteSet,
  sessionDurationMs,
  sessionProgress,
  sessionVolumeKg,
} from "./session-stats";
import { startSession } from "./start-session";
import type { Session } from "../types/session";

function runningSession() {
  let routine = createRoutine("Treino A");
  const supino = createRoutineExercise({
    exerciseId: "supino-reto-barra",
    name: "Supino Reto com Barra",
  });
  routine = addExercise(routine, supino);
  routine = updateExercise(routine, supino.id, { restSeconds: 90 });

  for (const set of supino.sets) {
    routine = updateSet(routine, supino.id, set.id, {
      reps: 8,
      weightKg: 60,
      rpe: 8,
    });
  }

  const session = startSession(routine, 1_000);
  const exercise = session.exercises[0]!;

  return { routine, session, exerciseId: exercise.id, setIds: exercise.sets.map((s) => s.id) };
}

describe("completing sets", () => {
  it("marks a set done", () => {
    const { session, exerciseId, setIds } = runningSession();
    const after = completeSet(session, exerciseId, setIds[0]!);

    expect(after.exercises[0]?.sets[0]?.isCompleted).toBe(true);
  });

  it("can be undone", () => {
    const { session, exerciseId, setIds } = runningSession();
    const after = uncompleteSet(
      completeSet(session, exerciseId, setIds[0]!),
      exerciseId,
      setIds[0]!,
    );

    expect(after.exercises[0]?.sets[0]?.isCompleted).toBe(false);
  });

  it("leaves the other sets alone", () => {
    const { session, exerciseId, setIds } = runningSession();
    const after = completeSet(session, exerciseId, setIds[1]!);

    expect(after.exercises[0]?.sets.map((s) => s.isCompleted)).toEqual([
      false,
      true,
      false,
    ]);
  });
});

describe("editing during the workout", () => {
  it("changes what was actually lifted without touching the plan", () => {
    const { session, exerciseId, setIds } = runningSession();
    const after = updatePerformedSet(session, exerciseId, setIds[0]!, {
      reps: 6,
      weightKg: 65,
      rpe: 9,
    });

    const set = after.exercises[0]?.sets[0];
    expect(set).toMatchObject({ reps: 6, weightKg: 65, rpe: 9 });
    // The frozen target is what makes the plan-versus-reality reading possible.
    expect(set?.planned).toEqual({ reps: 8, weightKg: 60, rpe: 8 });
  });

  it("adds an extra set with no plan behind it", () => {
    const { session, exerciseId } = runningSession();
    const after = addPerformedSet(session, exerciseId);
    const added = after.exercises[0]?.sets[3];

    expect(after.exercises[0]?.sets).toHaveLength(4);
    // Nothing prescribed it, so there is nothing to compare it against.
    expect(added?.planned).toBeNull();
    // But it copies the numbers, because an extra set is more of the same.
    expect(added).toMatchObject({ reps: 8, weightKg: 60, isCompleted: false });
  });

  it("removes a set", () => {
    const { session, exerciseId, setIds } = runningSession();

    expect(
      removePerformedSet(session, exerciseId, setIds[0]!).exercises[0]?.sets,
    ).toHaveLength(2);
  });

  it("records a note against the exercise", () => {
    const { session, exerciseId } = runningSession();
    const after = setSessionExerciseNotes(session, exerciseId, "Ombro incomodou");

    expect(after.exercises[0]?.notes).toBe("Ombro incomodou");
  });
});

describe("finishing", () => {
  it("stamps the end", () => {
    const { session } = runningSession();

    expect(finishSession(session, 5_000).finishedAt).toBe(5_000);
  });

  it("is idempotent, so a double tap cannot rewrite the end time", () => {
    const { session } = runningSession();
    const finished = finishSession(session, 5_000);

    expect(finishSession(finished, 9_000)).toBe(finished);
  });

  it("keeps sets that were never done", () => {
    // "I planned four and did three" is information. Discarding the fourth
    // would erase it.
    const { session, exerciseId, setIds } = runningSession();
    const finished = finishSession(completeSet(session, exerciseId, setIds[0]!), 5_000);

    expect(finished.exercises[0]?.sets).toHaveLength(3);
    expect(sessionProgress(finished)).toEqual({ completed: 1, total: 3 });
  });

  it("can be reopened", () => {
    const { session } = runningSession();

    expect(reopenSession(finishSession(session, 5_000)).finishedAt).toBeNull();
  });
});

describe("statistics", () => {
  it("counts only completed sets as progress", () => {
    const { session, exerciseId, setIds } = runningSession();
    const after = completeSet(
      completeSet(session, exerciseId, setIds[0]!),
      exerciseId,
      setIds[1]!,
    );

    expect(sessionProgress(after)).toEqual({ completed: 2, total: 3 });
  });

  it("counts volume only from completed sets", () => {
    const { session, exerciseId, setIds } = runningSession();

    expect(sessionVolumeKg(session)).toBe(0);
    expect(sessionVolumeKg(completeSet(session, exerciseId, setIds[0]!))).toBe(480);
  });

  it("ignores a completed set with no weight, which is unmeasured and not zero", () => {
    const { session, exerciseId, setIds } = runningSession();
    const bodyweight = updatePerformedSet(session, exerciseId, setIds[0]!, {
      weightKg: null,
    });

    expect(sessionVolumeKg(completeSet(bodyweight, exerciseId, setIds[0]!))).toBe(0);
  });

  it("points at the first set not yet done", () => {
    const { session, exerciseId, setIds } = runningSession();

    expect(nextIncompleteSet(session)).toEqual({ exerciseId, setId: setIds[0] });
    expect(nextIncompleteSet(completeSet(session, exerciseId, setIds[0]!))).toEqual({
      exerciseId,
      setId: setIds[1],
    });
  });

  it("points at nothing once everything is done", () => {
    const { session, exerciseId, setIds } = runningSession();
    const all = setIds.reduce(
      (current, setId) => completeSet(current, exerciseId, setId),
      session,
    );

    expect(nextIncompleteSet(all)).toBeNull();
  });

  it("has no duration until it is finished", () => {
    const { session } = runningSession();

    expect(sessionDurationMs(session)).toBeNull();
    expect(sessionDurationMs(finishSession(session, 61_000))).toBe(60_000);
  });

  it("reports how far the effort drifted from the plan", () => {
    const { session, exerciseId, setIds } = runningSession();
    const harder = updatePerformedSet(session, exerciseId, setIds[0]!, {
      reps: 6,
      rpe: 9,
    });

    expect(comparePlanned(harder.exercises[0]!.sets[0]!)).toMatchObject({
      repsDelta: -2,
      rpeDelta: 1,
    });
  });

  it("reports no delta for a set nothing planned", () => {
    const { session, exerciseId } = runningSession();
    const extra = addPerformedSet(session, exerciseId);

    expect(comparePlanned(extra.exercises[0]!.sets[3]!)).toEqual({
      repsDelta: null,
      weightDelta: null,
      rpeDelta: null,
    });
  });
});

describe("formatDuration", () => {
  it.each([
    [0, "0:00"],
    [45_000, "0:45"],
    [90_000, "1:30"],
    [3_600_000, "1:00:00"],
    [3_725_000, "1:02:05"],
  ])("formats %ims as %s", (ms, expected) => {
    expect(formatDuration(ms)).toBe(expected);
  });
});

describe("independence during the workout", () => {
  it("never touches the routine, however much the session is edited", () => {
    const { routine, session, exerciseId, setIds } = runningSession();
    const before = structuredClone(routine);

    let live = completeSet(session, exerciseId, setIds[0]!);
    live = updatePerformedSet(live, exerciseId, setIds[1]!, { reps: 20, weightKg: 200 });
    live = addPerformedSet(live, exerciseId);
    live = setSessionExerciseNotes(live, exerciseId, "mudou tudo");
    live = finishSession(live, 9_999);

    // The session really did change...
    expect(live.finishedAt).toBe(9_999);
    expect(live.exercises[0]?.sets).toHaveLength(4);
    // ...and the plan is untouched.
    expect(routine).toEqual(before);
  });
});

describe("stale references", () => {
  it("ignores an unknown exercise or set instead of throwing", () => {
    const { session, exerciseId, setIds } = runningSession();

    expect(completeSet(session, "gone", setIds[0]!)).toBe(session);
    expect(completeSet(session, exerciseId, "gone")).toBe(session);
    expect(addPerformedSet(session, "gone")).toBe(session);
  });
});

describe("moveSessionToDay", () => {
  /** A session that started on 07/08/2026 at 07:12 and ran `minutes`. */
  function trainedOn(minutes: number): Session {
    const startedAt = new Date(2026, 7, 7, 7, 12).getTime();

    return {
      ...runningSession().session,
      startedAt,
      finishedAt: startedAt + minutes * 60_000,
    };
  }

  it("preserves the duration, because only the calendar day is wrong", () => {
    // The gap between start and finish is what was actually measured. A
    // 47-minute workout stays 47 minutes long on whatever day it is filed.
    const moved = moveSessionToDay(trainedOn(47), "2026-08-05");

    expect(sessionDurationMs(moved)).toBe(47 * 60_000);
  });

  it("keeps the time of day", () => {
    // Somebody is fixing which day they trained, not what time they trained.
    const started = new Date(
      moveSessionToDay(trainedOn(30), "2026-08-05").startedAt,
    );

    expect(started.getDate()).toBe(5);
    expect(started.getHours()).toBe(7);
    expect(started.getMinutes()).toBe(12);
  });

  it("moves only the start of a session still running", () => {
    const moved = moveSessionToDay(runningSession().session, "2026-08-05");

    expect(moved.finishedAt).toBeNull();
    expect(new Date(moved.startedAt).getDate()).toBe(5);
  });

  it("returns the same session for a day it is already on", () => {
    // No write, no bumped `updatedAt`, no pointless sync later.
    const session = trainedOn(30);

    expect(moveSessionToDay(session, "2026-08-07")).toBe(session);
  });

  it("ignores an unparseable day rather than producing an invalid date", () => {
    const session = trainedOn(30);

    expect(moveSessionToDay(session, "")).toBe(session);
    expect(moveSessionToDay(session, "ontem")).toBe(session);
  });
});