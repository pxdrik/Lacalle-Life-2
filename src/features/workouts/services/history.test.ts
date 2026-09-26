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
  recentProgress,
  volumeByPeriod,
  type VolumePoint,
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
    durationSeconds: null,
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
    const sessions = [session(1_000, [], true), session(2_000, [], false)];

    expect(finishedSessions(sessions).map((s) => s.startedAt)).toEqual([1_000]);
  });

  it("orders most recent first", () => {
    const sessions = [
      session(1_000, []),
      session(3_000, []),
      session(2_000, []),
    ];

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

    expect(lastPerformance(withAbandoned, SUPINO)?.sets[0]?.weightKg).toBe(
      57.5,
    );
  });

  it("ignores the workout in progress, so it cannot answer about itself", () => {
    const current = session(40 * DAY, [
      exercise(SUPINO, "Supino", [set(8, 65)]),
    ]);

    expect(
      lastPerformance([...history, current], SUPINO, current.id)?.sets[0]
        ?.weightKg,
    ).toBe(57.5);
  });

  it("looks up a whole workout in one pass", () => {
    const found = lastPerformanceByExercise(history, [
      SUPINO,
      AGACHAMENTO,
      "outro",
    ]);

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
      session(1 * DAY, [
        exercise(SUPINO, "Supino", [set(8, 60), set(1, 200, false)]),
      ]),
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
    expect(points[2]).toMatchObject({ volumeKg: 0, sessions: 0, durationMs: 0 });
  });

  it("adds up finished session duration per week alongside volume", () => {
    // `session()` finishes every session an hour after it starts.
    const points = volumeByPeriod(history, 4, startOfWeek, now);

    expect(points[0]?.durationMs).toBe(3_600_000);
    expect(points[1]?.durationMs).toBe(3_600_000);
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

/**
 * `recentProgress` — o resumo que responde "o que mudou" antes do gráfico.
 *
 * Os pontos são construídos à mão em vez de saírem de `volumeByPeriod`: um
 * teste que alimenta a função com a saída da função ao lado prova que as
 * duas concordam, não que a conta está certa. Aqui os números de entrada são
 * escolhidos para que a resposta seja conferível de cabeça.
 */
describe("recentProgress", () => {
  const point = (
    weeksAgo: number,
    volumeKg: number,
    sessions = 1,
    durationMs = 3_600_000,
  ): VolumePoint => ({
    startsAt: -weeksAgo * 7 * DAY,
    volumeKg,
    sets: sessions * 3,
    sessions,
    durationMs,
  });

  /** Doze semanas, como a tela pede — as quatro recentes e as quatro
   * anteriores com o dobro/metade exatos, para a fração ser óbvia. */
  const twelveWeeks = [
    point(0, 300),
    point(1, 300),
    point(2, 200),
    point(3, 200),
    // janela anterior: 800 no total, contra 1000 da atual → +25%
    point(4, 200),
    point(5, 200),
    point(6, 200),
    point(7, 200),
    point(8, 0, 0, 0),
    point(9, 0, 0, 0),
    point(10, 0, 0, 0),
    point(11, 0, 0, 0),
  ];

  it("soma treinos, volume e duração só da janela atual", () => {
    const summary = recentProgress(twelveWeeks);

    expect(summary.weeks).toBe(4);
    expect(summary.volumeKg).toBe(1000);
    expect(summary.sessions).toBe(4);
    expect(summary.durationMs).toBe(4 * 3_600_000);
  });

  it("compara contra a janela anterior de mesmo tamanho", () => {
    // 1000 contra 800.
    expect(recentProgress(twelveWeeks).volumeChange).toBeCloseTo(0.25, 10);
  });

  it("devolve queda como fração negativa", () => {
    const falling = [
      point(0, 100),
      point(1, 100),
      point(2, 100),
      point(3, 100),
      point(4, 200),
      point(5, 200),
      point(6, 200),
      point(7, 200),
    ];

    // 400 contra 800.
    expect(recentProgress(falling).volumeChange).toBeCloseTo(-0.5, 10);
  });

  /**
   * A guarda que importa. `volumeByPeriod` semeia todas as doze semanas com
   * zero, então o balde anterior **existe** mesmo para quem treina há duas
   * semanas — e dividir por ele daria "+∞%" ou um "+100%" que descreve o
   * nada. Este é o caso de todo usuário novo, não uma borda rara.
   */
  it("não compara quando não houve volume na janela anterior", () => {
    const brandNew = [
      point(0, 300),
      point(1, 200),
      point(2, 0, 0, 0),
      point(3, 0, 0, 0),
      point(4, 0, 0, 0),
      point(5, 0, 0, 0),
      point(6, 0, 0, 0),
      point(7, 0, 0, 0),
    ];

    const summary = recentProgress(brandNew);

    expect(summary.volumeChange).toBeNull();
    // …mas o que aconteceu continua sendo dito.
    expect(summary.volumeKg).toBe(500);
    expect(summary.sessions).toBe(2);
  });

  it("não compara quando não há duas janelas inteiras de pontos", () => {
    const short = [point(0, 300), point(1, 200), point(2, 100), point(3, 100)];

    expect(recentProgress(short).volumeChange).toBeNull();
    expect(recentProgress(short).volumeKg).toBe(700);
  });

  it("chama de −100% parar de treinar, em vez de omitir", () => {
    const stopped = [
      point(0, 0, 0, 0),
      point(1, 0, 0, 0),
      point(2, 0, 0, 0),
      point(3, 0, 0, 0),
      point(4, 200),
      point(5, 200),
      point(6, 200),
      point(7, 200),
    ];

    const summary = recentProgress(stopped);

    expect(summary.volumeChange).toBe(-1);
    expect(summary.sessions).toBe(0);
  });
});
