import { createEntityId, revise } from "@/core/domain/entity";

import type { Meal, MealItem } from "../types/diet";
import type { FoodLog } from "../types/food-log";

export interface MealOption {
  /** `"principal"` para os alimentos da refeição; o id da opção para as outras. */
  readonly id: string;
  readonly name: string;
  readonly items: readonly MealItem[];
}

/** A refeição do plano e as outras opções que a nutricionista deixou, nessa ordem. */
export function mealOptions(planMeal: Meal): readonly MealOption[] {
  return [{ id: "principal", name: "Principal", items: planMeal.items }, ...(planMeal.alternatives ?? [])];
}

/**
 * "Opção de hoje" (estudo do paciente, 30/09/2026): a refeição do dia passa a
 * ter os alimentos da opção escolhida. Só o dia muda; o plano continua igual.
 *
 * Nenhum campo novo no Diário (uma versão antiga do app descartaria o dia):
 * a opção vale pelo conteúdo. `items` e `plannedSnapshot` são o mesmo array,
 * como em `snapshotMeal`, para o Diário seguir vendo a refeição como
 * "planejada" e não como "alterada" (`mealCheckState` compara a referência).
 */
export function chooseMealOption(log: FoodLog, mealId: string, option: MealOption): FoodLog {
  const items = option.items.map((item) => ({ ...item, id: createEntityId() }));
  return revise(log, {
    meals: log.meals.map((meal) => (meal.id === mealId ? { ...meal, items, plannedSnapshot: items } : meal)),
  });
}

/**
 * Qual opção a refeição do dia segue, pelo que foi planejado nela: mesmos
 * alimentos, mesmas quantidades, na mesma ordem. `null` quando não bate com
 * nenhuma (refeição montada antes de a opção existir, ou de outra versão).
 */
export function currentOption(meal: Meal, options: readonly MealOption[]): MealOption | null {
  const planned = signature(meal.plannedSnapshot ?? meal.items);
  return options.find((option) => signature(option.items) === planned) ?? null;
}

function signature(items: readonly MealItem[]): string {
  return items.map((item) => `${item.foodId ?? item.name}:${String(item.grams)}`).join("|");
}
