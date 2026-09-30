import { entityTimestamp, type Entity } from "@/core/domain/entity";

/**
 * Um dia que a pessoa marcou como descanso — roadmap 7.5 (30/09/2026).
 *
 * **Existir é a marca.** Não há campo "é descanso": o registro existe ou não,
 * e desmarcar é remover. O id é o dia, mesma convenção de `WaterEntry` e
 * `BodyEntry`.
 *
 * Sempre escolha da pessoa: dia sem treino nunca vira descanso sozinho.
 */
export interface RestDay extends Entity {
  /** Dia local, `YYYY-MM-DD`. Mesmo valor de `id`. */
  readonly day: string;
}

export function createRestDay(day: string): RestDay {
  const now = entityTimestamp();

  return { id: day, day, createdAt: now, updatedAt: now };
}
