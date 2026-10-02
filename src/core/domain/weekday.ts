/**
 * Os dias da semana, como o app guarda ("mon" a "sun") e como mostra. Moram
 * em `core` desde a Etapa 8 do Life Pro: começaram nas dietas, e os treinos
 * prescritos também têm dias. `diet-schedule.ts` reexporta tudo, então nada
 * do que já importava de lá muda.
 */
export type Weekday = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export const WEEKDAYS: readonly Weekday[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

export const WEEKEND_DAYS: readonly Weekday[] = ["sat", "sun"];

export const WEEKDAY_LABELS: Record<Weekday, string> = {
  mon: "Segunda",
  tue: "Terça",
  wed: "Quarta",
  thu: "Quinta",
  fri: "Sexta",
  sat: "Sábado",
  sun: "Domingo",
};

export const WEEKDAY_SHORT_LABELS: Record<Weekday, string> = {
  mon: "Seg",
  tue: "Ter",
  wed: "Qua",
  thu: "Qui",
  fri: "Sex",
  sat: "Sáb",
  sun: "Dom",
};

/** JS's `Date#getDay()` is 0 = Sunday; ours starts the week on Monday. */
const FROM_JS_DAY: readonly Weekday[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

export function weekdayOf(date: Date): Weekday {
  return FROM_JS_DAY[date.getDay()]!;
}

/** Os dias de um treino prescrito: sem nenhum, o paciente faz quando quiser (0038). */
export function describeRoutineDays(days: readonly Weekday[]): string {
  return days.length === 0 ? "Quando quiser" : describeWeekdays(days);
}

/** "Todos os dias", "Nenhum dia" ou "Seg, Qua, Sex", na ordem da semana. */
export function describeWeekdays(days: readonly Weekday[]): string {
  if (WEEKDAYS.every((day) => days.includes(day))) return "Todos os dias";
  const inOrder = WEEKDAYS.filter((day) => days.includes(day));
  if (inOrder.length === 0) return "Nenhum dia";
  return inOrder.map((day) => WEEKDAY_SHORT_LABELS[day]).join(", ");
}
