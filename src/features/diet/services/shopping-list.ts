import { formatDecimal } from "@/core/format/decimal";
import { FOOD_CATEGORY_LABELS, type FoodCategory } from "@/features/foods";

import type { Diet, MealItemUnit } from "../types/diet";
import { WEEKDAY_SHORT_LABELS } from "./diet-schedule";

export interface ShoppingItem {
  readonly name: string;
  readonly unit: MealItemUnit;
  /** Inteiro, arredondado para cima: sobrar uma fração é melhor que faltar. */
  readonly amount: number;
}

export interface ShoppingGroup {
  /** `null` quando o alimento não está mais no catálogo ou é de fora dele. */
  readonly category: FoodCategory | null;
  readonly title: string;
  readonly items: readonly ShoppingItem[];
}

/** Uma dieta que entrou na conta, com os dias em que ela vale. */
export interface ShoppingSource {
  readonly name: string;
  readonly days: string;
}

export interface ShoppingList {
  readonly sources: readonly ShoppingSource[];
  readonly groups: readonly ShoppingGroup[];
}

const OTHER_TITLE = "Outros";
const CATEGORIES = Object.keys(FOOD_CATEGORY_LABELS) as FoodCategory[];

/**
 * O que comprar para uma semana: cada dieta com dias marcados entra tantas
 * vezes quantos forem esses dias, e o mesmo alimento é somado entre
 * refeições e dietas.
 *
 * Só o que a dieta pede, do jeito que pede. Nada de converter peso cozido em
 * cru nem de arredondar para embalagem: quem monta a dieta com "300 g de arroz
 * cozido" recebe "300 g de arroz cozido" na lista. Dieta sem dia marcado fica
 * de fora (não há semana a que ela pertença), e as alternativas de uma
 * refeição também: a lista segue o que está montado hoje.
 *
 * `categoryOf` é passado de fora porque o item da dieta só guarda o `foodId`;
 * a categoria mora no catálogo.
 */
export function buildShoppingList(
  diets: readonly Diet[],
  categoryOf: (foodId: string) => FoodCategory | undefined,
): ShoppingList {
  const sources: ShoppingSource[] = [];
  const totals = new Map<
    string,
    { name: string; unit: MealItemUnit; category: FoodCategory | null; grams: number }
  >();

  for (const diet of diets) {
    const days = diet.weekdays.length;
    if (days === 0) continue;

    sources.push({
      name: diet.name === "" ? "Dieta sem nome" : diet.name,
      days: diet.weekdays.map((day) => WEEKDAY_SHORT_LABELS[day]).join(", "),
    });

    for (const meal of diet.meals) {
      for (const item of meal.items) {
        // Um item gravado antes de existirem líquidos não tem `unit`: o banco
        // não obedece ao tipo, e "g" é o que ele sempre foi.
        const unit: MealItemUnit = item.unit === "ml" ? "ml" : "g";
        const key =
          item.foodId === null
            ? `nome:${item.name.trim().toLowerCase()}|${unit}`
            : `${item.foodId}|${unit}`;

        const entry = totals.get(key) ?? {
          name: item.name.trim(),
          unit,
          category: item.foodId === null ? null : (categoryOf(item.foodId) ?? null),
          grams: 0,
        };
        entry.grams += item.grams * days;
        totals.set(key, entry);
      }
    }
  }

  const groups: ShoppingGroup[] = [...CATEGORIES, null].flatMap((category) => {
    const items = [...totals.values()]
      .filter((entry) => entry.category === category && entry.grams > 0)
      .map((entry) => ({
        name: entry.name,
        unit: entry.unit,
        // Duas casas antes do teto: 12,3 g x 10 dá 123,00000000000001 em
        // ponto flutuante, e sem isso o teto viraria 124.
        amount: Math.ceil(Math.round(entry.grams * 100) / 100),
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

    return items.length === 0
      ? []
      : [
          {
            category,
            title: category === null ? OTHER_TITLE : FOOD_CATEGORY_LABELS[category],
            items,
          },
        ];
  });

  return { sources, groups };
}

/** "800 g", "1,4 kg", "300 ml", "1,5 L". Mil ou mais sobe de unidade. */
export function formatAmount(amount: number, unit: MealItemUnit): string {
  return amount >= 1000
    ? `${formatDecimal(amount / 1000)} ${unit === "g" ? "kg" : "L"}`
    : `${formatDecimal(amount)} ${unit}`;
}

/** Texto puro, do jeito que se cola numa conversa. */
export function shoppingListText(list: ShoppingList): string {
  const lines = ["Lista de compras da semana", ""];

  lines.push(
    `Dietas: ${list.sources.map((s) => `${s.name} (${s.days})`).join(", ")}`,
    "",
  );

  for (const group of list.groups) {
    lines.push(group.title);
    for (const item of group.items) {
      lines.push(`- ${item.name}: ${formatAmount(item.amount, item.unit)}`);
    }
    lines.push("");
  }

  return lines.join("\n").trimEnd();
}
