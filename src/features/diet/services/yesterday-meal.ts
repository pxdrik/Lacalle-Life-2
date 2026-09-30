import { createEntityId, type EntityId } from "@/core/domain/entity";

import type { Meal, MealItem, MealOwner } from "../types/diet";
import type { FoodLog } from "../types/food-log";
import { addItem, removeItem } from "./edit-diet";
import { eatenMeals } from "./meal-execution";

/**
 * "Igual a ontem?" — roadmap 7.3 (30/09/2026), padrão do Lifesum.
 *
 * A refeição equivalente de ontem é a que tem o **mesmo nome**, ignorando
 * maiúsculas e espaços nas pontas ("Almoço" e "almoço " são a mesma). Com
 * as mesmas regras dos recentes (7.2): só refeição comida, e só se ela tinha
 * alguma coisa — oferecer copiar uma refeição vazia não ajuda ninguém.
 */
export function sameMealYesterday(
  yesterday: FoodLog | undefined,
  mealName: string,
): Meal | undefined {
  const key = normalize(mealName);
  if (yesterday === undefined || key === "") return undefined;

  return eatenMeals(yesterday).find(
    (meal) => normalize(meal.name) === key && meal.items.length > 0,
  );
}

/**
 * Cópias dos itens, com ids novos e as mesmas gramas.
 *
 * Os ids são gerados aqui, fora do `apply` do Diário, para que o "Desfazer"
 * saiba exatamente o que remover: são os mesmos ids que entraram.
 */
export function copiesOf(items: readonly MealItem[]): readonly MealItem[] {
  return items.map((item) => ({ ...item, id: createEntityId() }));
}

export function addItems<T extends MealOwner>(
  owner: T,
  mealId: EntityId,
  items: readonly MealItem[],
): T {
  return items.reduce((current, item) => addItem(current, mealId, item), owner);
}

/** O "Desfazer": tira só o que foi copiado, deixa o resto da refeição. */
export function removeItems<T extends MealOwner>(
  owner: T,
  mealId: EntityId,
  itemIds: readonly EntityId[],
): T {
  return itemIds.reduce((current, id) => removeItem(current, mealId, id), owner);
}

function normalize(name: string): string {
  return name.trim().toLocaleLowerCase("pt-BR");
}
