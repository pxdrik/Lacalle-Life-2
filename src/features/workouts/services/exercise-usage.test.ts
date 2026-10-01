import { describe, expect, it } from "vitest";

import type { Session } from "../types/session";
import { exerciseUsage, mostUsed, recentlyUsed } from "./exercise-usage";

/** Roadmap 10.4 (30/09/2026): "Feitos recentemente" e "Mais feitos". */

const DAY = 86_400_000;

function session(id: string, startedAt: number, done: readonly string[], skipped: readonly string[] = [], finished = true): Session {
  const exercise = (exerciseId: string, completed: boolean) => ({
    id: `${id}-${exerciseId}`,
    exerciseId,
    name: exerciseId,
    restSeconds: null,
    notes: "",
    sets: [{ id: "s", reps: 8, weightKg: 60, rpe: null, durationSeconds: null, isCompleted: completed, planned: null }],
  });
  return {
    id,
    routineId: null,
    name: "Treino",
    startedAt,
    finishedAt: finished ? startedAt + 3_600_000 : null,
    exercises: [...done.map((x) => exercise(x, true)), ...skipped.map((x) => exercise(x, false))],
    createdAt: startedAt,
    updatedAt: startedAt,
  };
}

const SESSIONS = [
  session("a", 1 * DAY, ["supino", "agachamento"]),
  session("b", 2 * DAY, ["supino", "rosca"]),
  session("c", 3 * DAY, ["puxada"], ["supino"]),
  session("d", 4 * DAY, ["agachamento"], [], false),
];

describe("uso dos exercícios", () => {
  it("conta só treino finalizado e só exercício com série concluída", () => {
    const uses = new Map(exerciseUsage(SESSIONS).map((use) => [use.exerciseId, use]));

    expect(uses.get("supino")?.sessions).toBe(2);
    expect(uses.get("agachamento")?.sessions).toBe(1);
    expect(uses.get("supino")?.lastAt).toBe(2 * DAY);
  });

  it("recentes: do mais recente para o mais antigo, até 3; no mesmo treino, na ordem do treino", () => {
    expect(recentlyUsed(exerciseUsage(SESSIONS)).map((use) => use.exerciseId)).toEqual([
      "puxada",
      "supino",
      "rosca",
    ]);
  });

  it("mais feitos: mais treinos primeiro, e no empate o mais recente", () => {
    expect(mostUsed(exerciseUsage(SESSIONS)).map((use) => use.exerciseId)).toEqual([
      "supino",
      "puxada",
      "rosca",
    ]);
  });

  it("sem treino, nada", () => {
    expect(exerciseUsage([])).toEqual([]);
  });
});
