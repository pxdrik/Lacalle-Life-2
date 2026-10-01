import type { EntityId } from "@/core/domain/entity";

import type { Session } from "../types/session";
import { finishedSessions } from "./history";

/** Quantos aparecem em cada seção do topo de Exercícios. */
export const USAGE_LIMIT = 3;

export interface ExerciseUse {
  readonly exerciseId: EntityId;
  /** Início do treino mais recente em que foi feito. */
  readonly lastAt: number;
  /** Em quantos treinos foi feito. */
  readonly sessions: number;
}

/**
 * "Feitos recentemente" e "Mais feitos" (roadmap 10.4, 30/09/2026), dos
 * treinos já salvos, sem dado novo.
 *
 * As regras de `exerciseHistory` (7.4): só treino finalizado, e só conta o
 * exercício que teve pelo menos uma série concluída. Abrir e não fazer não é
 * uso.
 */
export function exerciseUsage(sessions: readonly Session[]): readonly ExerciseUse[] {
  const byId = new Map<EntityId, { lastAt: number; sessions: number }>();

  for (const session of finishedSessions(sessions)) {
    const done = new Set(
      session.exercises
        .filter((exercise) => exercise.sets.some((set) => set.isCompleted))
        .map((exercise) => exercise.exerciseId),
    );
    for (const exerciseId of done) {
      const current = byId.get(exerciseId);
      byId.set(exerciseId, {
        lastAt: Math.max(current?.lastAt ?? 0, session.startedAt),
        sessions: (current?.sessions ?? 0) + 1,
      });
    }
  }

  return [...byId].map(([exerciseId, use]) => ({ exerciseId, ...use }));
}

/** Do mais recente para o mais antigo. */
export function recentlyUsed(uses: readonly ExerciseUse[], limit = USAGE_LIMIT): readonly ExerciseUse[] {
  return [...uses].sort((a, b) => b.lastAt - a.lastAt).slice(0, limit);
}

/** Mais treinos primeiro; no empate, o feito mais recente. */
export function mostUsed(uses: readonly ExerciseUse[], limit = USAGE_LIMIT): readonly ExerciseUse[] {
  return [...uses].sort((a, b) => b.sessions - a.sessions || b.lastAt - a.lastAt).slice(0, limit);
}
