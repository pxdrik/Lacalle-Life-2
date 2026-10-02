import { describeWeekdays, WEEKDAYS, type Weekday } from "@/core/domain/weekday";

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

/** Versão nova que o paciente ainda não abriu (nunca na primeira que chega), como o plano. */
export function isUpdated(routine: PrescribedRoutine): boolean {
  return routine.seenVersion > 0 && routine.seenVersion < routine.version;
}

/** "5 exercícios · 17 séries", como a linha de um treino da pessoa. */
export function describeRoutineSize(routine: Pick<Routine, "exercises">): string {
  const exercises = routine.exercises.length;
  const sets = routine.exercises.reduce((sum, exercise) => sum + exercise.sets.length, 0);
  return `${exercises} ${exercises === 1 ? "exercício" : "exercícios"} · ${sets} ${sets === 1 ? "série" : "séries"}`;
}

/**
 * O treino do treinador para este dia da semana, o que a tela Hoje sugere
 * (Etapa 8e). Só os de vínculo ativo: encerrado o acompanhamento, o treino
 * fica em Treinos mas sai do dia, como o plano sai do Diário. Mais recente
 * primeiro, como a lista.
 */
export function routinesForWeekday(
  routines: readonly PrescribedRoutine[],
  weekday: Weekday,
): readonly PrescribedRoutine[] {
  return routines.filter((routine) => !routine.linkEnded && routine.weekdays.includes(weekday));
}

/**
 * A linha da tela Hoje num dia sem treino do treinador: quando ele é, ou que
 * está em Treinos para quando quiser. `null` sem treino de vínculo ativo.
 */
export function trainerScheduleLine(routines: readonly PrescribedRoutine[]): string | null {
  const active = routines.filter((routine) => !routine.linkEnded);
  if (active.length === 0) return null;
  const days = WEEKDAYS.filter((day) => active.some((routine) => routine.weekdays.includes(day)));
  return days.length === 0
    ? "O treino do seu treinador está em Treinos, para quando você quiser."
    : `O treino do seu treinador é em ${describeWeekdays(days)}.`;
}
