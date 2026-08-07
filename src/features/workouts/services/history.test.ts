import { describe, expect, it } from "vitest";

import type { PerformedSet, Session, SessionExercise } from "../types/session";
import {
  estimateOneRepMax,
  finishedSessions,
  lastPerformance,
  lastPerformanceByExercise,
  personalRecords,
  startOfMonth,
  startOfWeek,
  volumeByPeriod,
} from "./history";

const DAY = 86_400_000;

function set(
  reps: number | null,
  weightKg: number | null,
  isCompleted = true,
): PerformedSet {
  return {
    id: `set-${String(Math.random())}`,
    reps,
    weightKg,
    rpe: null,
    isCompleted,
    planned: null,
  };
}

function exercise(
  exerciseId: string,
  name: string,
  sets: PerformedSet[],
): SessionExercise {
  return {
    id: `ex-${exerciseId}-${String(Math.random())}`,
    exerciseId,
    name,
    sets,
    restSeconds: null,
    notes: "",
  };
}

function session(
  startedAt: number,
  exercises: SessionExercise[],
  finished = true,
): Session {
  return {
    id: `session-${String(startedAt)}`,
    routineId: null,
    name: "Treino A",
    startedAt,
    finishedAt: finished ? startedAt + 3_600_000 : null,
    exercises,
    createdAt: startedAt,
    updatedAt: startedAt,
  };
}

const SUPINO = "supino-reto-barra";
const AGACHAMENTO = "agachamento-livre-barra";

describe("finishedSessions", () => {
  it("excludes a workout still in progress", () => {
    // One in progress is not a fact yet.
    const sessions = [
      session(1_000, [], true),
      session(2_000, [], false),
    ];

    expect(finishedSessions(sessions).map((s) => s.startedAt)).toEqual([1_000]);
  });

  it("orders most recent first", () => {
    const sessions = [session(1_000, []), session(3_000, []), session(2_000, [])];

    expect(finishedSessions(sessions).map((s) => s.startedAt)).toEqual([
      3_000, 2_000, 1_000,
    ]);
  });
});

describe("lastPerformance", () => {
  const history = [
    session(10 * DAY, [exercise(SUPINO, "Supino", [set(8, 50)])]),
    session(20 * DAY, [exercise(SUPINO, "Supino", [set(8, 57.5)])]),
    session(15 * DAY, [exercise(AGACHAMENTO, "Agachamento", [set(5, 100)])]),
  ];

  it("finds the most recent time the exercise was trained", () => {
    expect(lastPerformance(history, SUPINO)?.sets[0]?.weightKg).toBe(57.5);
  });

  it("is null for an exercise never done", () => {
    expect(lastPerformance(history, "nunca-fiz")).toBeNull();
  });

  it("skips a session where every set was left undone", () => {
    // Opening the app and abandoning the workout is not a performance.
    const withAbandoned = [
      ...history,
      session(30 * DAY, [exercise(SUPINO, "Supino", [set(8, 80, false)])]),
    ];

    expect(lastPerformance(withAbandoned, SUPINO)?.sets[0]?.weightKg).toBe(57.5);
  });

  it("ignores the workout in progress, so it cannot answer about itself", () => {
    const current = session(40 * DAY, [exercise(SUPINO, "Supino", [set(8, 65)])]);

    expect(lastPerformance([...history, current], SUPINO, current.id)?.sets[0]?.weightKg)
      .toBe(57.5);
  });

  it("looks up a whole workout in one pass", () => {
    const found = lastPerformanceByExercise(history, [SUPINO, AGACHAMENTO, "outro"]);

    expect(found.size).toBe(2);
    expect(found.get(AGACHAMENTO)?.sets[0]?.weightKg).toBe(100);
  });
});

describe("estimateOneRepMax", () => {
  it("returns the weight itself for a single", () => {
    expect(estimateOneRepMax(100, 1)).toBe(100);
  });

  it("applies Epley above one rep", () => {
    // 60 × (1 + 8/30) = 76
    expect(estimateOneRepMax(60, 8)).toBe(76);
  });

  it("ranks a heavier single above a lighter set of many", () => {
    expect(estimateOneRepMax(100, 1)).toBeGreaterThan(estimateOneRepMax(70, 5));
  });

  it("is zero for nonsense input", () => {
    expect(estimateOneRepMax(0, 8)).toBe(0);
    expect(estimateOneRepMax(60, 0)).toBe(0);
  });
});

describe("personalRecords", () => {
  it("is empty with no history", () => {
    expect(personalRecords([])).toEqual([]);
  });

  it("finds the heaviest completed set", () => {
    const history = [
      session(1 * DAY, [exercise(SUPINO, "Supino", [set(8, 60), set(5, 70)])]),
      session(2 * DAY, [exercise(SUPINO, "Supino", [set(8, 65)])]),
    ];

    expect(personalRecords(history)[0]).toMatchObject({
      heaviestKg: 70,
      repsAtHeaviest: 5,
    });
  });

  it("tracks heaviest and best estimated single separately", () => {
    // 100 × 1 is heavier; 80 × 8 estimates higher. Collapsing them would hide
    // one of the two.
    const history = [
      session(1 * DAY, [exercise(SUPINO, "Supino", [set(1, 100), set(8, 80)])]),
    ];
    const record = personalRecords(history)[0];

    expect(record?.heaviestKg).toBe(100);
    expect(record?.bestOneRepMax).toBe(101.3);
  });

  it("ignores sets that were not completed", () => {
    const history = [
      session(1 * DAY, [exercise(SUPINO, "Supino", [set(8, 60), set(1, 200, false)])]),
    ];

    expect(personalRecords(history)[0]?.heaviestKg).toBe(60);
  });

  it("ignores a bodyweight set, which has no kilograms to record", () => {
    const history = [
      session(1 * DAY, [exercise(SUPINO, "Supino", [set(10, null)])]),
    ];

    expect(personalRecords(history)).toEqual([]);
  });

  it("keeps one record per exercise", () => {
    const history = [
      session(1 * DAY, [
        exercise(SUPINO, "Supino", [set(8, 60)]),
        exercise(AGACHAMENTO, "Agachamento", [set(5, 100)]),
      ]),
    ];

    expect(personalRecords(history)).toHaveLength(2);
  });

  it("records when the record happened", () => {
    const history = [
      session(1 * DAY, [exercise(SUPINO, "Supino", [set(8, 60)])]),
      session(5 * DAY, [exercise(SUPINO, "Supino", [set(8, 70)])]),
    ];

    expect(personalRecords(history)[0]?.heaviestAt).toBe(5 * DAY);
  });
});

describe("startOfWeek", () => {
  it("starts the week on Monday", () => {
    // 2026-08-06 is a Thursday; the week began on 2026-08-03.
    const thursday = new Date(2026, 7, 6, 15, 30).getTime();
    const monday = new Date(2026, 7, 3, 0, 0, 0, 0).getTime();

    expect(startOfWeek(thursday)).toBe(monday);
  });

  it("treats Sunday as the end of the week, not the start", () => {
    const sunday = new Date(2026, 7, 9, 10, 0).getTime();
    const monday = new Date(2026, 7, 3, 0, 0, 0, 0).getTime();

    expect(startOfWeek(sunday)).toBe(monday);
  });

  it("is stable for a timestamp already at the boundary", () => {
    const monday = new Date(2026, 7, 3, 0, 0, 0, 0).getTime();

    expect(startOfWeek(monday)).toBe(monday);
  });
});

describe("volumeByPeriod", () => {
  const now = new Date(2026, 7, 6, 12, 0).getTime();
  const thisWeek = new Date(2026, 7, 4, 10, 0).getTime();
  const lastWeek = new Date(2026, 6, 29, 10, 0).getTime();

  const history = [
    session(thisWeek, [exercise(SUPINO, "Supino", [set(8, 60), set(8, 60)])]),
    session(lastWeek, [exercise(SUPINO, "Supino", [set(10, 50)])]),
  ];

  it("adds up completed volume per week", () => {
    const points = volumeByPeriod(history, 4, startOfWeek, now);

    expect(points[0]).toMatchObject({ volumeKg: 960, sets: 2, sessions: 1 });
    expect(points[1]).toMatchObject({ volumeKg: 500, sets: 1, sessions: 1 });
  });

  it("includes empty periods, because a gap is what the chart is for", () => {
    const points = volumeByPeriod(history, 4, startOfWeek, now);

    expect(points).toHaveLength(4);
    expect(points[2]).toMatchObject({ volumeKg: 0, sessions: 0 });
  });

  it("orders most recent first", () => {
    const points = volumeByPeriod(history, 4, startOfWeek, now);
    const timestamps = points.map((p) => p.startsAt);

    expect(timestamps).toEqual([...timestamps].sort((a, b) => b - a));
  });

  it("drops history older than the window", () => {
    const ancient = session(new Date(2020, 0, 1).getTime(), [
      exercise(SUPINO, "Supino", [set(10, 100)]),
    ]);
    const points = volumeByPeriod([...history, ancient], 4, startOfWeek, now);

    expect(points.reduce((sum, p) => sum + p.volumeKg, 0)).toBe(1460);
  });

  it("buckets by month when asked to", () => {
    const points = volumeByPeriod(history, 2, startOfMonth, now);

    // August holds one session, July the other.
    expect(points[0]?.sessions).toBe(1);
    expect(points[1]?.sessions).toBe(1);
  });
});
