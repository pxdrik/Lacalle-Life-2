import { revise } from "@/core/domain/entity";
import { weekdayOf } from "@/core/domain/weekday";

import type { Diet, Weekday } from "../types/diet";
import type { PrescribedPlan } from "../types/prescribed-plan";

import { planAsDiet } from "./prescribed-plan";

// Moraram aqui até a Etapa 8; agora em `core/domain/weekday.ts`.
export type { Weekday };
export {
  WEEKDAYS,
  WEEKEND_DAYS,
  WEEKDAY_LABELS,
  WEEKDAY_SHORT_LABELS,
  describeWeekdays,
  weekdayOf,
} from "@/core/domain/weekday";


/**
 * Reassigns a set of weekdays to `dietId`, taking them away from any other
 * diet that currently holds them.
 *
 * A weekday is a calendar slot, not a tag: it can point at one diet at a
 * time, the same way a given Monday can only be one thing when the Diário
 * asks "what's planned today?". Letting two diets both claim "segunda"
 * would just move the ambiguity from this screen to that one.
 *
 * Returns only the diets that actually changed reference-inequal from their
 * input — callers save the difference, not the whole list.
 */
export function assignWeekdays(
  diets: readonly Diet[],
  dietId: string,
  weekdays: readonly Weekday[],
): readonly Diet[] {
  const claimed = new Set(weekdays);

  return diets.map((diet) => {
    if (diet.id === dietId) {
      const same =
        diet.weekdays.length === weekdays.length &&
        diet.weekdays.every((day) => claimed.has(day));
      return same ? diet : revise(diet, { weekdays });
    }

    const remaining = diet.weekdays.filter((day) => !claimed.has(day));
    return remaining.length === diet.weekdays.length
      ? diet
      : revise(diet, { weekdays: remaining });
  });
}

/** The diet linked to a given weekday, if any. */
export function dietForWeekday(
  diets: readonly Diet[],
  weekday: Weekday,
): Diet | undefined {
  return diets.find((diet) => diet.weekdays.includes(weekday));
}

/**
 * O que está planejado para uma data. Etapa 5e (decisão do Pedro,
 * 01/10/2026): os dias do plano são da nutricionista, e num dia dele o plano
 * é o padrão. Se o dia também for de uma dieta da pessoa, ela escolhe qual
 * usar (`dayChoice`), e a escolha fica no próprio dia (`FoodLog.dietId`,
 * passado aqui como `chosenId`), à vista da profissional no acompanhamento.
 *
 * - O plano só vale a partir do dia em que existe: a Evolução não cobra de
 *   ninguém, no passado, um plano que ainda não tinha chegado.
 * - Vínculo encerrado: o plano sai do Diário. Um dia que já tinha sido feito
 *   pelo plano (`chosenId`) continua contando como dele.
 */
export function dietOfDay(
  diets: readonly Diet[],
  plans: readonly PrescribedPlan[],
  date: Date,
  chosenId: string | null = null,
): Diet | undefined {
  const weekday = weekdayOf(date);
  const own = dietForWeekday(diets, weekday);
  const plan = planOfWeekday(plans, date, chosenId);
  if (own !== undefined && (plan === undefined || chosenId === own.id)) return own;
  return plan === undefined ? undefined : planAsDiet(plan);
}

/**
 * Um dia do plano que também é de uma dieta da pessoa: as duas opções, para
 * o Diário perguntar qual vale hoje. `undefined` quando não há o que escolher.
 */
export function dayChoice(
  diets: readonly Diet[],
  plans: readonly PrescribedPlan[],
  date: Date,
): { readonly plan: PrescribedPlan; readonly own: Diet } | undefined {
  const own = dietForWeekday(diets, weekdayOf(date));
  const plan = planOfWeekday(plans, date, null);
  return own === undefined || plan === undefined ? undefined : { plan, own };
}

function planOfWeekday(
  plans: readonly PrescribedPlan[],
  date: Date,
  chosenId: string | null,
): PrescribedPlan | undefined {
  const weekday = weekdayOf(date);
  return plans.find(
    (plan) =>
      (!plan.linkEnded || plan.id === chosenId) &&
      plan.weekdays.includes(weekday) &&
      endOfDay(date) >= plan.createdAt,
  );
}

function endOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1).getTime() - 1;
}
