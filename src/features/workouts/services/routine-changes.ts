import type { Weekday } from "@/core/domain/weekday";

import type { PlannedSet, RoutineExercise } from "../types/routine";

/**
 * O que mudou de uma versão do treino do treinador para a seguinte (Etapa 8f,
 * protótipo aprovado em 01/10/2026): exercício que entrou ou saiu, séries,
 * carga e dias. Como o "o que mudou" do plano, só o que dá para afirmar a
 * partir das duas versões.
 *
 * Os exercícios se reconhecem pelo id da posição (`RoutineExercise.id`): o
 * editor do Life Pro edita o mesmo rascunho, e trocar o exercício mantém a
 * posição (`replaceExercise`), então troca vira "no lugar de", não "saiu e
 * entrou". A ordem não entra.
 */
export type RoutineChange =
  | { readonly kind: "days"; readonly from: readonly Weekday[]; readonly to: readonly Weekday[] }
  | { readonly kind: "added"; readonly exercise: string; readonly sets: number; readonly reps: number | null }
  | { readonly kind: "removed"; readonly exercise: string }
  | { readonly kind: "changed"; readonly exercise: string; readonly details: readonly ExerciseDetail[] };

/** Um valor de antes e de depois; `null` é a meta em branco. */
type Delta = { readonly from: number | null; readonly to: number | null };

export type ExerciseDetail =
  | { readonly kind: "replaced"; readonly from: string }
  | ({ readonly kind: "sets" } & Delta)
  | ({ readonly kind: "weight" } & Delta)
  | ({ readonly kind: "reps" } & Delta)
  | ({ readonly kind: "rpe" } & Delta)
  | ({ readonly kind: "duration" } & Delta)
  /** Séries com metas diferentes entre si mudaram: não cabe num "de, para". */
  | { readonly kind: "targets" }
  | ({ readonly kind: "rest" } & Delta)
  | { readonly kind: "notes" };

const FIELDS = ["weightKg", "reps", "rpe", "durationSeconds"] as const;
const FIELD_KIND = { weightKg: "weight", reps: "reps", rpe: "rpe", durationSeconds: "duration" } as const;

export function compareRoutines(
  previous: readonly RoutineExercise[],
  current: readonly RoutineExercise[],
  days: { readonly before: readonly Weekday[]; readonly after: readonly Weekday[] },
): readonly RoutineChange[] {
  const before = new Map(previous.map((exercise) => [exercise.id, exercise]));
  const after = new Set(current.map((exercise) => exercise.id));
  const changes: RoutineChange[] = [];

  if (!sameDays(days.before, days.after)) changes.push({ kind: "days", from: days.before, to: days.after });

  for (const exercise of current) {
    const old = before.get(exercise.id);
    if (old === undefined) {
      changes.push({
        kind: "added",
        exercise: exercise.name,
        sets: exercise.sets.length,
        reps: uniform(exercise.sets, "reps") ?? null,
      });
      continue;
    }
    const details = compareExercise(old, exercise);
    if (details.length > 0) changes.push({ kind: "changed", exercise: exercise.name, details });
  }
  for (const exercise of previous) {
    if (!after.has(exercise.id)) changes.push({ kind: "removed", exercise: exercise.name });
  }
  return changes;
}

function compareExercise(old: RoutineExercise, now: RoutineExercise): ExerciseDetail[] {
  const details: ExerciseDetail[] = [];
  if (old.exerciseId !== now.exerciseId) details.push({ kind: "replaced", from: old.name });
  if (old.sets.length !== now.sets.length) details.push({ kind: "sets", from: old.sets.length, to: now.sets.length });

  let targets = false;
  for (const field of FIELDS) {
    const from = uniform(old.sets, field);
    const to = uniform(now.sets, field);
    if (from !== undefined && to !== undefined) {
      if (from !== to) details.push({ kind: FIELD_KIND[field], from, to });
    } else if (!sameOnCommonSets(old.sets, now.sets, field)) {
      targets = true;
    }
  }
  if (targets) details.push({ kind: "targets" });

  if (old.restSeconds !== now.restSeconds) details.push({ kind: "rest", from: old.restSeconds, to: now.restSeconds });
  if (old.notes.trim() !== now.notes.trim()) details.push({ kind: "notes" });
  return details;
}

/**
 * O valor que todas as séries têm em comum, ou `undefined` quando elas
 * diferem entre si. Sem séries, a meta é `null`, a meta em branco.
 */
function uniform(sets: readonly PlannedSet[], field: (typeof FIELDS)[number]): number | null | undefined {
  const [first] = sets;
  if (first === undefined) return null;
  return sets.every((set) => set[field] === first[field]) ? first[field] : undefined;
}

/** Série a série, nas que existem nas duas versões: séries a mais ou a menos já são "sets". */
function sameOnCommonSets(a: readonly PlannedSet[], b: readonly PlannedSet[], field: (typeof FIELDS)[number]): boolean {
  const common = Math.min(a.length, b.length);
  for (let index = 0; index < common; index += 1) {
    if (a[index]![field] !== b[index]![field]) return false;
  }
  return true;
}

function sameDays(a: readonly Weekday[], b: readonly Weekday[]): boolean {
  return a.length === b.length && a.every((day) => b.includes(day));
}
