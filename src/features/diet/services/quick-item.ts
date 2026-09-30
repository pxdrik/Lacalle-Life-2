import { createEntityId } from "@/core/domain/entity";

import type { MealItem, QuickMacro } from "../types/diet";

/**
 * Registro rápido (roadmap 7.7, 30/09/2026): o item "Avulso". Ver
 * `MealItem.quick` para o formato e o porquê.
 */

export const QUICK_MACROS: readonly QuickMacro[] = ["proteinG", "carbsG", "fatG"];

/** O nome de um avulso sem descrição. */
export const QUICK_DEFAULT_NAME = "Avulso";

export interface QuickInput {
  readonly name: string;
  readonly kcal: number;
  /** `null` é "não sei", nunca zero. */
  readonly proteinG: number | null;
  readonly carbsG: number | null;
  readonly fatG: number | null;
}

export function isQuickItem(item: MealItem): boolean {
  return item.quick !== undefined;
}

export function createQuickItem(input: QuickInput): MealItem {
  return quickItem(createEntityId(), input);
}

/** Mesmo item (mesmo id), valores novos: editar não é remover e criar. */
export function editQuickItem(item: MealItem, input: QuickInput): MealItem {
  return quickItem(item.id, input);
}

/** O avulso de volta nos campos da folha, com o branco como branco. */
export function quickInputOf(item: MealItem): QuickInput {
  const unknown = new Set(item.quick?.unknownMacros ?? []);
  const value = (key: QuickMacro) => (unknown.has(key) ? null : item.per100g[key]);

  return {
    name: item.name === QUICK_DEFAULT_NAME ? "" : item.name,
    kcal: item.per100g.kcal,
    proteinG: value("proteinG"),
    carbsG: value("carbsG"),
    fatG: value("fatG"),
  };
}

/**
 * Quantos avulsos deixaram cada macro em branco, num conjunto de itens (uma
 * refeição, um dia). Zero em todos: o total está completo. Qualquer coisa
 * acima: o total daquele macro soma só o que se sabe, e a tela diz isso.
 */
export function quickGaps(items: Iterable<MealItem>): Readonly<Record<QuickMacro, number>> {
  const gaps = { proteinG: 0, carbsG: 0, fatG: 0 };
  for (const item of items) {
    for (const key of item.quick?.unknownMacros ?? []) gaps[key] += 1;
  }
  return gaps;
}

/** Quantos avulsos com algum macro em branco (para a nota "sem N item avulso"). */
export function incompleteQuickCount(items: Iterable<MealItem>): number {
  let count = 0;
  for (const item of items) {
    if ((item.quick?.unknownMacros.length ?? 0) > 0) count += 1;
  }
  return count;
}

function quickItem(id: string, input: QuickInput): MealItem {
  const name = input.name.trim() === "" ? QUICK_DEFAULT_NAME : input.name.trim();

  return {
    id,
    foodId: null,
    name,
    // O total inteiro em `per100g`, com 100 g: `itemMacros` devolve os
    // valores exatamente como digitados, e nenhuma soma do app muda.
    grams: 100,
    unit: "g",
    per100g: {
      kcal: input.kcal,
      proteinG: input.proteinG ?? 0,
      carbsG: input.carbsG ?? 0,
      fatG: input.fatG ?? 0,
    },
    quick: { unknownMacros: QUICK_MACROS.filter((key) => input[key] === null) },
  };
}
