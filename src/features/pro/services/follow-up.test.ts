import { describe, expect, it } from "vitest";

import type { PatientSession } from "../types/follow-up";
import type { RoutineSummary } from "../types/routine";
import { NOT_SHARED } from "../types/follow-up";
import { attentionOf, overviewOf, weekOf, weekStart, workoutTiles } from "./follow-up";

/**
 * As contas do acompanhamento (Etapa 6): a semana com os dias prescritos, os
 * números do topo de Treinos e "Precisa de atenção". Semana de 28/09 a
 * 04/10/2026, hoje sexta 02/10; Treino A seg/qua/sex, Treino B ter/qui.
 */
const at = (day: string, hour = 7) => new Date(`${day}T${String(hour).padStart(2, "0")}:00:00`).getTime();
const routine = (id: string, name: string, weekdays: RoutineSummary["versions"][number]["weekdays"]): RoutineSummary => ({
  id,
  name,
  hasDraft: false,
  versions: [{ version: 1, name, changeNote: "", publishedAt: "2026-09-20T12:00:00Z", weekdays }],
});
const A = routine("ra", "Treino A", ["mon", "wed", "fri"]);
const B = routine("rb", "Treino B", ["tue", "thu"]);
const session = (day: string, name: string, routineId: string | null, volumeKg = 1000, minutes = 50): PatientSession => ({
  id: `${day}-${name}`,
  routineId,
  name,
  startedAt: at(day),
  durationMs: minutes * 60_000,
  setsDone: 10,
  setsTotal: 10,
  volumeKg,
  exercises: [],
});
const TODAY = "2026-10-02";
const SESSIONS = [
  session("2026-10-02", "Treino A", "ra", 5840, 52),
  session("2026-10-01", "Treino B", "rb", 3120, 47),
  session("2026-09-30", "Treino A", "ra", 5610, 55),
  session("2026-09-28", "Treino A", "ra", 4900, 49),
  session("2026-09-27", "Corrida leve", null, 0, 32),
  session("2026-09-22", "Treino A", "ra", 15_000, 60),
];

describe("a semana do paciente", () => {
  it("começa na segunda, inclusive quando hoje é domingo", () => {
    expect(weekStart("2026-10-02")).toBe("2026-09-28");
    expect(weekStart("2026-10-04")).toBe("2026-09-28");
    expect(weekStart("2026-09-28")).toBe("2026-09-28");
  });

  it("feito, faltou, por fazer e sem treino", () => {
    expect(weekOf(TODAY, SESSIONS, [A, B]).map((day) => [day.day, day.state, day.prescribed.join("+")])).toEqual([
      ["2026-09-28", "done", "Treino A"],
      ["2026-09-29", "missed", "Treino B"],
      ["2026-09-30", "done", "Treino A"],
      ["2026-10-01", "done", "Treino B"],
      ["2026-10-02", "done", "Treino A"],
      ["2026-10-03", "free", ""],
      ["2026-10-04", "free", ""],
    ]);
  });

  it("hoje sem treino ainda é por fazer, não falta", () => {
    const [, , , , friday] = weekOf(TODAY, SESSIONS.slice(1), [A, B]);
    expect(friday!.state).toBe("due");
  });

  it("os números do topo", () => {
    expect(workoutTiles(TODAY, at(TODAY, 12), SESSIONS, [A, B])).toMatchObject({
      daysDue: 5,
      daysDone: 4,
      last14: 6,
      last14Prescribed: 5,
      weekVolumeKg: 19_470,
      weekVolumeChange: Math.round(((19_470 - 15_000) / 15_000) * 100),
      averageMinutes: Math.round((52 + 47 + 55 + 49 + 32 + 60) / 6),
    });
  });

  it("treino sem dias não cria dia prescrito; sem base, a variação do volume é nula", () => {
    const free = routine("rf", "Livre", []);
    const tiles = workoutTiles(TODAY, at(TODAY, 12), [session(TODAY, "Livre", "rf")], [free]);
    expect(tiles).toMatchObject({ daysDue: 0, daysDone: 0, weekVolumeChange: null });
  });
});

describe("precisa de atenção", () => {
  const linkDay = "2026-07-03";

  it("parado pelo último sinal do que é liberado", () => {
    expect(attentionOf(TODAY, { linkDay, sessionDay: "2026-09-26", diaryDay: "2026-09-25" }, null)).toEqual({ kind: "stale", days: 6 });
    expect(attentionOf(TODAY, { linkDay, sessionDay: "2026-09-26", diaryDay: "2026-09-29" }, null)).toBeNull();
  });

  it("sem nada liberado não se diz parado; recém-chegado também não", () => {
    expect(attentionOf(TODAY, { linkDay, sessionDay: undefined, diaryDay: undefined }, null)).toBeNull();
    expect(attentionOf(TODAY, { linkDay: "2026-10-01", sessionDay: null, diaryDay: null }, null)).toBeNull();
    expect(attentionOf(TODAY, { linkDay, sessionDay: null, diaryDay: undefined }, null)).toMatchObject({ kind: "stale" });
  });

  it("menos da metade dos dias do treino na semana", () => {
    const recent = { linkDay, sessionDay: TODAY, diaryDay: TODAY };
    expect(attentionOf(TODAY, recent, { done: 1, due: 3 })).toEqual({ kind: "few-workouts", done: 1, due: 3 });
    expect(attentionOf(TODAY, recent, { done: 2, due: 4 }), "metade não é menos da metade").toBeNull();
    expect(attentionOf(TODAY, recent, { done: 0, due: 0 })).toBeNull();
  });
});

describe("a Visão geral", () => {
  const links = [
    { id: "ana", label: "Ana", createdAt: "2026-07-03T12:00:00Z" },
    { id: "jorge", label: "Jorge", createdAt: "2026-07-03T12:00:00Z" },
    { id: "bruno", label: "Bruno", createdAt: "2026-07-03T12:00:00Z" },
    { id: "camila", label: "Camila", createdAt: "2026-07-03T12:00:00Z" },
  ];
  const rows = [
    { linkId: "ana", lastSessionAt: at(TODAY), sessions: ["2026-09-28", "2026-09-30", "2026-10-02"].map((day) => ({ routineId: "ra", startedAt: at(day) })), lastDiaryDay: TODAY, weightNow: 68.6, weightMonthAgo: 69.2 },
    { linkId: "jorge", lastSessionAt: at("2026-09-28"), sessions: [{ routineId: "ra", startedAt: at("2026-09-28") }], lastDiaryDay: "2026-10-01", weightNow: NOT_SHARED, weightMonthAgo: NOT_SHARED },
    { linkId: "bruno", lastSessionAt: at("2026-10-01"), sessions: [], lastDiaryDay: NOT_SHARED, weightNow: NOT_SHARED, weightMonthAgo: NOT_SHARED },
    { linkId: "camila", lastSessionAt: at("2026-09-24"), sessions: [], lastDiaryDay: "2026-09-26", weightNow: 70.2, weightMonthAgo: null },
  ] as const;
  const routines = new Map([["ana", [A]], ["jorge", [A]]]);

  it("os números, só pelo que cada um libera", () => {
    const summary = overviewOf(TODAY, at(TODAY, 12), links, rows, routines);
    expect(summary).toMatchObject({ active: 4, trained: { count: 3, of: 4 }, logged: { count: 2, of: 3 }, stale: 1 });
  });

  it("quem precisa de atenção, e por quê", () => {
    const { patients } = overviewOf(TODAY, at(TODAY, 12), links, rows, routines);
    expect(patients.map((patient) => [patient.label, patient.attention])).toEqual([
      ["Ana", null],
      ["Jorge", { kind: "few-workouts", done: 1, due: 3 }],
      ["Bruno", null],
      ["Camila", { kind: "stale", days: 6 }],
    ]);
    expect(patients[0]!.weightChange).toBeCloseTo(-0.6);
    expect(patients[1]!.weightNow, "peso de quem não libera").toBeUndefined();
    expect(patients[3]!.weightChange, "sem peso de 30 dias atrás").toBeNull();
  });
});
