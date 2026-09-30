import { formatShortDay } from "@/core/format/day";
import { formatDecimal } from "@/core/format/decimal";
import type { RecentFood } from "@/features/foods";

import type { FoodLog } from "../types/food-log";
import { eatenMeals } from "./meal-execution";

/** Quantos recentes o seletor mostra. Mais que isso vira uma segunda lista. */
export const RECENT_FOODS_LIMIT = 6;

/**
 * Os alimentos que a pessoa comeu por último, do mais recente para o mais
 * antigo, sem repetir — roadmap 7.2 (30/09/2026), padrão do Lifesum.
 *
 * - **Só o que foi comido** (`eatenMeals`): uma refeição planejada que ainda
 *   não foi marcada não conta, porque "recente" é o que a pessoa registrou,
 *   não o que a dieta dela previa.
 * - **Só alimento do catálogo** (`foodId`): um item sem `foodId` (avulso, ou
 *   uma refeição transformada em um alimento) não tem para onde voltar no
 *   seletor.
 * - **Dentro do dia, a última refeição primeiro**, e dentro dela o último
 *   item: é a ordem em que foram registrados.
 * - **A primeira ocorrência vence**: ela traz a quantidade mais recente.
 *
 * `today` e `yesterday` entram por parâmetro (`dayKey` do chamador) para o
 * resultado não depender do relógio, e dias futuros são ignorados.
 */
export function recentFoods(
  logs: readonly FoodLog[],
  today: string,
  yesterday: string,
  limit = RECENT_FOODS_LIMIT,
): RecentFood[] {
  const seen = new Set<string>();
  const recents: RecentFood[] = [];
  const newestFirst = [...logs]
    .filter((log) => log.day <= today)
    .sort((a, b) => b.day.localeCompare(a.day));

  for (const log of newestFirst) {
    for (const meal of [...eatenMeals(log)].reverse()) {
      for (const item of [...meal.items].reverse()) {
        if (item.foodId === null || seen.has(item.foodId)) continue;
        seen.add(item.foodId);
        recents.push({
          foodId: item.foodId,
          grams: item.grams,
          detail: [
            dayLabel(log.day, today, yesterday),
            meal.name.trim() === "" ? "Refeição" : meal.name,
            `${formatDecimal(item.grams)} ${item.unit}`,
          ].join(" · "),
        });
        if (recents.length >= limit) return recents;
      }
    }
  }

  return recents;
}

function dayLabel(day: string, today: string, yesterday: string): string {
  if (day === today) return "Hoje";
  if (day === yesterday) return "Ontem";
  return formatShortDay(day);
}
