import { describe, expect, it } from "vitest";

import type { PlannedSet, RoutineExercise } from "../types/routine";
import { compareRoutines } from "./routine-changes";

/**
 * "O que mudou" na versão nova do treino do treinador (Etapa 8f): exercício
 * que entrou ou saiu, séries, carga e dias, exercício por exercício.
 */
const set = (id: string, weightKg: number | null, reps: number | null, rpe: number | null = 8): PlannedSet => ({
  id,
  weightKg,
  reps,
  rpe,
  durationSeconds: null,
});
const exercise = (id: string, name: string, sets: readonly PlannedSet[], extra: Partial<RoutineExercise> = {}): RoutineExercise => ({
  id,
  exerciseId: `cat-${name}`,
  name,
  sets,
  restSeconds: 90,
  notes: "",
  ...extra,
});

const squat = exercise("e1", "Agachamento", [set("s1", 60, 8), set("s2", 60, 8), set("s3", 60, 8)]);
const press = exercise("e2", "Leg press", [set("s4", 120, 12), set("s5", 120, 12)]);
const SAME = { before: ["mon", "wed"], after: ["mon", "wed"] } as const;

describe("o que mudou entre duas versões do treino", () => {
  it("nada mudou: nenhuma linha", () => {
    expect(compareRoutines([squat, press], [squat, press], SAME)).toEqual([]);
  });

  it("dias mudados viram uma linha; os mesmos em outra ordem, não; de dias para nenhum, sim", () => {
    const same = [squat];
    expect(compareRoutines(same, same, { before: ["mon", "wed", "fri"], after: ["mon", "thu"] })).toEqual([
      { kind: "days", from: ["mon", "wed", "fri"], to: ["mon", "thu"] },
    ]);
    expect(compareRoutines(same, same, { before: ["wed", "mon"], after: ["mon", "wed"] })).toEqual([]);
    expect(compareRoutines(same, same, { before: ["mon"], after: [] })).toEqual([{ kind: "days", from: ["mon"], to: [] }]);
  });

  it("carga e repetições iguais em todas as séries viram um 'de, para' cada", () => {
    const heavier = { ...squat, sets: squat.sets.map((s) => ({ ...s, weightKg: 70, reps: 6 })) };
    expect(compareRoutines([squat], [heavier], SAME)).toEqual([
      {
        kind: "changed",
        exercise: "Agachamento",
        details: [
          { kind: "weight", from: 60, to: 70 },
          { kind: "reps", from: 8, to: 6 },
        ],
      },
    ]);
  });

  it("uma série a mais com as mesmas metas é só 'séries', não carga", () => {
    const more = { ...squat, sets: [...squat.sets, set("s9", 60, 8)] };
    expect(compareRoutines([squat], [more], SAME)).toEqual([
      { kind: "changed", exercise: "Agachamento", details: [{ kind: "sets", from: 3, to: 4 }] },
    ]);
  });

  it("séries com metas diferentes entre si: uma linha de metas, sem inventar um 'de, para'", () => {
    const pyramid = { ...squat, sets: [set("s1", 60, 8), set("s2", 65, 8), set("s3", 70, 8)] };
    const steeper = { ...squat, sets: [set("s1", 60, 8), set("s2", 70, 8), set("s3", 80, 8)] };
    expect(compareRoutines([pyramid], [steeper], SAME)).toEqual([
      { kind: "changed", exercise: "Agachamento", details: [{ kind: "targets" }] },
    ]);
    expect(compareRoutines([pyramid], [{ ...pyramid, sets: [...pyramid.sets, set("s4", 75, 8)] }], SAME)).toEqual([
      { kind: "changed", exercise: "Agachamento", details: [{ kind: "sets", from: 3, to: 4 }] },
    ]);
  });

  it("entrou, saiu e trocou de exercício na mesma posição", () => {
    const stiff = exercise("e3", "Stiff", [set("s6", 20, 10), set("s7", 20, 10), set("s8", 20, 10)]);
    const hack = { ...press, exerciseId: "cat-Hack", name: "Hack" };
    expect(compareRoutines([squat, press], [hack, stiff], SAME)).toEqual([
      { kind: "changed", exercise: "Hack", details: [{ kind: "replaced", from: "Leg press" }] },
      { kind: "added", exercise: "Stiff", sets: 3, reps: 10 },
      { kind: "removed", exercise: "Agachamento" },
    ]);
  });

  it("descanso e observação", () => {
    const edited = { ...squat, restSeconds: 120, notes: "Desça até a coxa ficar paralela." };
    expect(compareRoutines([squat], [edited], SAME)).toEqual([
      {
        kind: "changed",
        exercise: "Agachamento",
        details: [{ kind: "rest", from: 90, to: 120 }, { kind: "notes" }],
      },
    ]);
  });
});
