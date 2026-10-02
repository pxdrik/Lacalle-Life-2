import type { Meal, MealItem, Weekday } from "../types/diet";
import { mealMacros } from "./diet-macros";

/**
 * O que mudou de uma versão do plano para a seguinte, para o paciente ler
 * (estudo aprovado em 30/09/2026: comparação automática mais a nota da
 * nutricionista). Só o que dá para dizer com certeza a partir das duas
 * versões; nada de interpretar a intenção de quem mudou.
 *
 * As refeições se reconhecem pelo id: o editor do Life Pro edita o mesmo
 * rascunho, então uma refeição mantém o id de uma versão para a outra. Os
 * alimentos, pelo alimento do catálogo (`foodId`), ou pelo nome num avulso.
 * Os dias (Etapa 5e) são da nutricionista e mudar os dias também é mudar o
 * plano; sem os dias da versão anterior, não se diz nada sobre eles.
 */
export type PlanChange =
  | { readonly kind: "meal-added"; readonly meal: string }
  | { readonly kind: "meal-removed"; readonly meal: string }
  | { readonly kind: "meal-renamed"; readonly from: string; readonly to: string }
  | { readonly kind: "item-added"; readonly meal: string; readonly item: string; readonly grams: number; readonly unit: string }
  | { readonly kind: "item-removed"; readonly meal: string; readonly item: string; readonly grams: number; readonly unit: string }
  | {
      readonly kind: "item-grams";
      readonly meal: string;
      readonly item: string;
      readonly from: number;
      readonly to: number;
      readonly unit: string;
    }
  | { readonly kind: "notes"; readonly meal: string }
  | { readonly kind: "options"; readonly meal: string; readonly from: number; readonly to: number }
  | { readonly kind: "days"; readonly from: readonly Weekday[]; readonly to: readonly Weekday[] };

export interface PlanComparison {
  readonly changes: readonly PlanChange[];
  readonly kcalBefore: number;
  readonly kcalAfter: number;
}

export function comparePlans(
  previous: readonly Meal[],
  current: readonly Meal[],
  days?: { readonly before: readonly Weekday[] | undefined; readonly after: readonly Weekday[] },
): PlanComparison {
  const before = new Map(previous.map((meal) => [meal.id, meal]));
  const after = new Set(current.map((meal) => meal.id));
  const changes: PlanChange[] = [];

  if (days?.before !== undefined && !sameDays(days.before, days.after)) {
    changes.push({ kind: "days", from: days.before, to: days.after });
  }

  for (const meal of current) {
    const old = before.get(meal.id);
    if (old === undefined) {
      changes.push({ kind: "meal-added", meal: meal.name });
      continue;
    }
    if (old.name !== meal.name) changes.push({ kind: "meal-renamed", from: old.name, to: meal.name });
    changes.push(...compareItems(meal.name, old.items, meal.items));
    if (old.notes.trim() !== meal.notes.trim()) changes.push({ kind: "notes", meal: meal.name });
    const optionsBefore = old.alternatives?.length ?? 0;
    const optionsAfter = meal.alternatives?.length ?? 0;
    if (optionsBefore !== optionsAfter) changes.push({ kind: "options", meal: meal.name, from: optionsBefore, to: optionsAfter });
  }
  for (const meal of previous) {
    if (!after.has(meal.id)) changes.push({ kind: "meal-removed", meal: meal.name });
  }

  return { changes, kcalBefore: totalKcal(previous), kcalAfter: totalKcal(current) };
}

function compareItems(meal: string, before: readonly MealItem[], after: readonly MealItem[]): PlanChange[] {
  const key = (item: MealItem) => item.foodId ?? `nome:${item.name}`;
  const old = new Map(before.map((item) => [key(item), item]));
  const now = new Set(after.map(key));
  const changes: PlanChange[] = [];

  for (const item of after) {
    const previous = old.get(key(item));
    if (previous === undefined) {
      changes.push({ kind: "item-added", meal, item: item.name, grams: item.grams, unit: item.unit });
    } else if (previous.grams !== item.grams) {
      changes.push({ kind: "item-grams", meal, item: item.name, from: previous.grams, to: item.grams, unit: item.unit });
    }
  }
  for (const item of before) {
    if (!now.has(key(item))) changes.push({ kind: "item-removed", meal, item: item.name, grams: item.grams, unit: item.unit });
  }
  return changes;
}

function sameDays(a: readonly Weekday[], b: readonly Weekday[]): boolean {
  return a.length === b.length && a.every((day) => b.includes(day));
}

function totalKcal(meals: readonly Meal[]): number {
  return meals.reduce((sum, meal) => sum + mealMacros(meal).kcal, 0);
}
