import type { PrescribedRoutine } from "../types/prescribed-routine";
import type { Routine } from "../types/routine";

/**
 * O treino recebido no formato de uma rotina do app, para iniciar
 * (`startSession`) e copiar (`duplicateRoutine`) pelo mesmo caminho dos
 * treinos da pessoa. O id é o do servidor: é ele que a sessão guarda em
 * `routineId`, dizendo de qual treino veio.
 */
export function prescribedAsRoutine(routine: PrescribedRoutine): Routine {
  return {
    id: routine.id,
    name: routine.name,
    notes: routine.notes,
    exercises: routine.exercises,
    createdAt: routine.createdAt,
    updatedAt: routine.updatedAt,
  };
}

/** "5 exercícios · 17 séries", como a linha de um treino da pessoa. */
export function describeRoutineSize(routine: Pick<Routine, "exercises">): string {
  const exercises = routine.exercises.length;
  const sets = routine.exercises.reduce((sum, exercise) => sum + exercise.sets.length, 0);
  return `${exercises} ${exercises === 1 ? "exercício" : "exercícios"} · ${sets} ${sets === 1 ? "série" : "séries"}`;
}
