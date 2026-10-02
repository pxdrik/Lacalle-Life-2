import { WEEKDAYS, weekdayOf, type Weekday } from "@/core/domain/weekday";
import { dayKey, shiftDay } from "@/core/format/day";

import { NOT_SHARED, type OverviewRow, type PatientSession, type Shared } from "../types/follow-up";
import type { RoutineSummary } from "../types/routine";

/**
 * As contas do acompanhamento (Etapa 6, protótipo aprovado em 02/10/2026),
 * puras: a semana com os dias do treino prescrito, os números do topo da aba
 * Treinos e quem precisa de atenção na Visão geral.
 */

const DAY_MS = 86_400_000;

/** A segunda-feira da semana do dia (`YYYY-MM-DD`), como o app começa a semana. */
export function weekStart(day: string): string {
  return shiftDay(day, -WEEKDAYS.indexOf(weekdayOfDay(day)));
}

/** Meio-dia: a data do dia, sem o fuso empurrar para o vizinho (visto na 8e). */
export function weekdayOfDay(day: string): Weekday {
  return weekdayOf(new Date(`${day}T12:00:00`));
}

/** O dia local de um instante do app (ms). */
export function dayOf(ms: number): string {
  return dayKey(new Date(ms));
}

/** Os treinos publicados com dias, por dia da semana; o mais recente primeiro. */
export function prescribedByWeekday(routines: readonly RoutineSummary[]): ReadonlyMap<Weekday, readonly RoutineSummary[]> {
  const byDay = new Map<Weekday, RoutineSummary[]>();
  for (const routine of routines) {
    for (const day of routine.versions[0]?.weekdays ?? []) {
      byDay.set(day, [...(byDay.get(day) ?? []), routine]);
    }
  }
  return byDay;
}

export type WeekDayState = "done" | "missed" | "due" | "free";

export interface WeekDay {
  readonly day: string;
  readonly weekday: Weekday;
  /** Os nomes dos treinos prescritos para o dia. */
  readonly prescribed: readonly string[];
  /** Os nomes dos treinos feitos no dia, de qualquer origem. */
  readonly done: readonly string[];
  /**
   * `done`: treinou num dia do treino prescrito; `missed`: dia prescrito que
   * passou sem treino; `due`: hoje ou à frente, ainda por fazer; `free`: dia
   * sem treino prescrito.
   */
  readonly state: WeekDayState;
}

/**
 * A semana de segunda a domingo. Num dia prescrito, qualquer treino feito
 * conta: o paciente pode trocar de treino, e o treinador vê qual foi.
 */
export function weekOf(
  today: string,
  sessions: readonly Pick<PatientSession, "startedAt" | "name">[],
  routines: readonly RoutineSummary[],
): readonly WeekDay[] {
  const start = weekStart(today);
  const byWeekday = prescribedByWeekday(routines);
  return WEEKDAYS.map((weekday, index) => {
    const day = shiftDay(start, index);
    const prescribed = (byWeekday.get(weekday) ?? []).map((routine) => routine.name);
    const done = sessions.filter((session) => dayOf(session.startedAt) === day).map((session) => session.name);
    const state: WeekDayState =
      prescribed.length === 0 ? "free" : done.length > 0 ? "done" : day < today ? "missed" : "due";
    return { day, weekday, prescribed, done, state };
  });
}

export interface WorkoutTiles {
  /** Dias prescritos da semana até hoje, e quantos foram feitos. */
  readonly daysDue: number;
  readonly daysDone: number;
  readonly missed: readonly WeekDay[];
  readonly last14: number;
  /** Dos últimos 14 dias, quantos vieram de um treino do treinador. */
  readonly last14Prescribed: number;
  readonly weekVolumeKg: number;
  /** Variação do volume sobre a semana anterior, em %; `null` sem base. */
  readonly weekVolumeChange: number | null;
  /** Duração média nos últimos 14 dias, em minutos; `null` sem treino. */
  readonly averageMinutes: number | null;
}

export function workoutTiles(
  today: string,
  now: number,
  sessions: readonly PatientSession[],
  routines: readonly RoutineSummary[],
): WorkoutTiles {
  const week = weekOf(today, sessions, routines);
  const elapsed = week.filter((day) => day.day <= today && day.state !== "free");
  const prescribedIds = new Set(routines.map((routine) => routine.id));
  const recent = sessions.filter((session) => session.startedAt >= now - 14 * DAY_MS);
  const start = weekStart(today);
  const previousStart = shiftDay(start, -7);
  const volume = (from: string, to: string) =>
    sessions
      .filter((session) => {
        const day = dayOf(session.startedAt);
        return day >= from && day < to;
      })
      .reduce((sum, session) => sum + session.volumeKg, 0);
  const thisWeek = volume(start, shiftDay(start, 7));
  const lastWeek = volume(previousStart, start);

  return {
    daysDue: elapsed.length,
    daysDone: elapsed.filter((day) => day.state === "done").length,
    missed: week.filter((day) => day.state === "missed"),
    last14: recent.length,
    last14Prescribed: recent.filter((session) => session.routineId !== null && prescribedIds.has(session.routineId)).length,
    weekVolumeKg: thisWeek,
    weekVolumeChange: lastWeek === 0 ? null : Math.round(((thisWeek - lastWeek) / lastWeek) * 100),
    averageMinutes:
      recent.length === 0 ? null : Math.round(recent.reduce((sum, session) => sum + session.durationMs, 0) / recent.length / 60_000),
  };
}

/** "Parado": sem treino e sem diário há esse tanto de dias (padrão do protótipo). */
export const STALE_DAYS = 5;

export type Attention =
  | { readonly kind: "stale"; readonly days: number }
  | { readonly kind: "few-workouts"; readonly done: number; readonly due: number };

/**
 * Por que um paciente aparece em "Precisa de atenção": parado (só pelo que
 * ele libera; sem nada liberado, não há como dizer), ou menos da metade dos
 * dias prescritos feitos na semana até hoje. `null` quando está em dia.
 *
 * `undefined` é "não libera"; `null`, "libera e nunca registrou". O dia em
 * que o vínculo começou conta como o último sinal: paciente que acabou de
 * aceitar não está parado.
 */
export function attentionOf(
  today: string,
  last: {
    readonly linkDay: string;
    readonly sessionDay: string | null | undefined;
    readonly diaryDay: string | null | undefined;
  },
  week: { readonly done: number; readonly due: number } | null,
): Attention | null {
  const known = [last.sessionDay, last.diaryDay].filter((day) => day !== undefined);
  if (known.length > 0) {
    const latest = [last.linkDay, ...known.filter((day): day is string => day !== null)].sort().at(-1)!;
    const days = daysBetween(latest, today);
    if (days >= STALE_DAYS) return { kind: "stale", days };
  }
  if (week !== null && week.due > 0 && week.done * 2 < week.due) {
    return { kind: "few-workouts", done: week.done, due: week.due };
  }
  return null;
}

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / DAY_MS);
}

export interface OverviewPatient {
  readonly linkId: string;
  readonly label: string;
  readonly lastSessionAt: number | null | undefined;
  readonly lastDiaryDay: string | null | undefined;
  readonly weightNow: number | null | undefined;
  /** Peso agora menos o de 30 dias atrás; `null` sem os dois. */
  readonly weightChange: number | null;
  readonly attention: Attention | null;
}

export interface OverviewSummary {
  readonly active: number;
  /** Dos que liberam treinos, quantos treinaram nos últimos 7 dias. */
  readonly trained: { readonly count: number; readonly of: number };
  /** Dos que liberam o diário, quantos registraram nos últimos 3 dias. */
  readonly logged: { readonly count: number; readonly of: number };
  readonly stale: number;
  readonly patients: readonly OverviewPatient[];
}

/**
 * A Visão geral (Etapa 6): por paciente ativo, só o que ele libera
 * (`undefined` é "não libera"), e quem precisa de atenção.
 */
export function overviewOf(
  today: string,
  now: number,
  links: readonly { readonly id: string; readonly label: string; readonly createdAt: string }[],
  rows: readonly OverviewRow[],
  routinesByLink: ReadonlyMap<string, readonly RoutineSummary[]>,
): OverviewSummary {
  const byLink = new Map(rows.map((row) => [row.linkId, row]));
  const patients = links.map((link): OverviewPatient => {
    const row = byLink.get(link.id);
    const value = <T,>(shared: Shared<T> | undefined): T | undefined => (shared === undefined || shared === NOT_SHARED ? undefined : shared);
    const lastSessionAt = value(row?.lastSessionAt);
    const sessions = value(row?.sessions);
    const weightNow = value(row?.weightNow);
    const weightMonthAgo = value(row?.weightMonthAgo);
    const week =
      sessions === undefined
        ? null
        : (() => {
            const days = weekOf(today, sessions.map((session) => ({ startedAt: session.startedAt, name: "" })), routinesByLink.get(link.id) ?? []);
            const elapsed = days.filter((day) => day.day <= today && day.state !== "free");
            return { due: elapsed.length, done: elapsed.filter((day) => day.state === "done").length };
          })();
    return {
      linkId: link.id,
      label: link.label,
      lastSessionAt,
      lastDiaryDay: value(row?.lastDiaryDay),
      weightNow,
      weightChange: weightNow == null || weightMonthAgo == null ? null : weightNow - weightMonthAgo,
      attention: attentionOf(
        today,
        {
          linkDay: link.createdAt.slice(0, 10),
          sessionDay: lastSessionAt === undefined ? undefined : lastSessionAt === null ? null : dayOf(lastSessionAt),
          diaryDay: value(row?.lastDiaryDay),
        },
        week,
      ),
    };
  });

  const sharingWorkouts = patients.filter((patient) => patient.lastSessionAt !== undefined);
  const sharingDiary = patients.filter((patient) => patient.lastDiaryDay !== undefined);
  return {
    active: links.length,
    trained: {
      count: sharingWorkouts.filter((patient) => patient.lastSessionAt != null && patient.lastSessionAt >= now - 7 * DAY_MS).length,
      of: sharingWorkouts.length,
    },
    logged: {
      count: sharingDiary.filter((patient) => patient.lastDiaryDay != null && patient.lastDiaryDay >= shiftDay(today, -2)).length,
      of: sharingDiary.length,
    },
    stale: patients.filter((patient) => patient.attention?.kind === "stale").length,
    patients,
  };
}
