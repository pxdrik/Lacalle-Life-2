import { describe, expect, it } from "vitest";

import { sessionExercisesPayloadSchema } from "@/composition/backup-schemas";

import type { PerformedSet, Session, SetKind } from "../types/session";
import { setPerformedSetKind } from "./edit-session";
import { exerciseHistory, personalRecords, volumeByPeriod, startOfWeek } from "./history";
import { sessionVolumeKg } from "./session-stats";

/**
 * Roadmap 7.6 (30/09/2026): tipo de série. A regra que muda número, decidida
 * pelo Pedro: **aquecimento fica fora do volume e dos recordes.** Drop set e
 * até a falha contam como qualquer série.
 */

const STARTED = new Date(2026, 8, 29, 7).getTime();

function set(id: string, weightKg: number, reps: number, kind?: SetKind): PerformedSet {
  return {
    id,
    reps,
    weightKg,
    rpe: null,
    durationSeconds: null,
    isCompleted: true,
    planned: null,
    ...(kind === undefined ? {} : { kind }),
  };
}

function session(sets: PerformedSet[]): Session {
  return {
    id: "s1",
    routineId: null,
    name: "Push",
    startedAt: STARTED,
    finishedAt: STARTED + 3_600_000,
    exercises: [
      { id: "e1", exerciseId: "supino", name: "Supino", sets, restSeconds: null, notes: "" },
    ],
    createdAt: STARTED,
    updatedAt: STARTED,
  };
}

// Aquecimento mais pesado que o trabalho de propósito: se ele contasse,
// viraria o recorde e a melhor série.
const WORKOUT = session([
  set("a", 100, 5, "warmup"),
  set("b", 60, 8),
  set("c", 40, 10, "drop"),
  set("d", 60, 6, "failure"),
]);

describe("aquecimento fora do volume e dos recordes", () => {
  it("volume do treino: só as séries de trabalho", () => {
    expect(sessionVolumeKg(WORKOUT).kg).toBe(60 * 8 + 40 * 10 + 60 * 6);
  });

  it("volume e contagem de séries da semana, na Evolução", () => {
    const [week] = volumeByPeriod([WORKOUT], 1, startOfWeek, STARTED);

    expect(week?.volumeKg).toBe(60 * 8 + 40 * 10 + 60 * 6);
    expect(week?.sets).toBe(3);
  });

  it("recorde e 1RM ignoram o aquecimento", () => {
    const [record] = personalRecords([WORKOUT]);

    expect(record?.heaviestKg).toBe(60);
    expect(record?.repsAtHeaviest).toBe(8);
  });

  it("no histórico do exercício, a série aparece mas não vira a melhor", () => {
    const [entry] = exerciseHistory([WORKOUT], "supino");

    expect(entry?.sets).toHaveLength(4);
    expect(entry?.topSet).toEqual({ weightKg: 60, reps: 8 });
  });
});

describe("gravar o tipo", () => {
  it("marca e volta a normal sem deixar o campo para trás", () => {
    const marked = setPerformedSetKind(session([set("b", 60, 8)]), "e1", "b", "warmup");
    expect(marked.exercises[0]!.sets[0]!.kind).toBe("warmup");

    const normal = setPerformedSetKind(marked, "e1", "b", null);
    // Sem a chave: é isso que mantém o treino legível por versões antigas.
    expect("kind" in normal.exercises[0]!.sets[0]!).toBe(false);
  });

  it("o esquema da sincronização e do backup aceita o tipo e recusa o que não existe", () => {
    expect(sessionExercisesPayloadSchema.safeParse({ exercises: WORKOUT.exercises }).success).toBe(true);

    const bogus = session([{ ...set("b", 60, 8), kind: "superset" as SetKind }]);
    expect(sessionExercisesPayloadSchema.safeParse({ exercises: bogus.exercises }).success).toBe(false);
  });
});
