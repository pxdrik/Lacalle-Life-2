"use client";

import { useCallback } from "react";

import { describeDataError } from "@/core/domain/describe-data-error";
import { useToast } from "@/design-system/components/toast";
import {
  createCustomFood,
  customFoodSchema,
  useFoodRepository,
  type FoodCategory,
} from "@/features/foods";

import { createMealItem } from "../services/create-diet";
import { combinedMealTotals } from "../services/diet-macros";
import { consolidateMealItems, undoConsolidateMealItems } from "../services/edit-diet";
import type { Meal, MealOwner } from "../types/diet";

/**
 * Turns a meal's several foods into one, saved to the catalogue — Pedro,
 * 23/09/2026: "minha refeição foi arroz, feijão, carne e purê, mas quero um
 * botão pra transformar ela em 'marmita de carne'... queria que isso
 * virasse um alimento, e eu poder usar em outros dias no diario e ate mesmo
 * adicionar na dieta. Ent ele deve criar um novo alimento mesmo."
 *
 * A real `Food`, not the one-off item the first version of this shipped
 * with — searching "Marmita de carne" on any other day, or while building a
 * diet, finds it the same as anything else in the catalogue.
 *
 * **Fire-and-forget from the caller's side, the same contract
 * `onSaveAlternative`/`onApplyAlternative` already have** — nothing here
 * blocks the dialog on a promise. A failure (name too long, a macro that
 * cannot exist, the write itself) surfaces as a toast instead of an inline
 * form error: rare enough — this only fails on data already validated
 * once, from meals a person could actually build — that a receipt naming
 * the problem beats a form staying open with nothing left to fix by hand.
 *
 * Success gets the same channel with an undo — Pedro: "faltou um botão
 * para desfazer" (24/09/2026: "quero que apareça o desfazer para uma
 * refeição que eu ja juntei", after the toast that first offered it was
 * long gone). `consolidateMealItems` freezes the previous items into the
 * meal's own `consolidatedFrom` field, so the toast's "Desfazer" and the
 * meal card's persistent "⋮ → Desfazer transformação" both just call
 * `undoConsolidateMealItems` — one mechanism, two entry points. The food
 * stays in the catalogue either way, deletable from Alimentos like any
 * other custom food, the same as it would be if it turned out to be a
 * mistake made through the normal create-food screen.
 *
 * `T extends MealOwner`, matching every other write in `edit-diet.ts` —
 * only `FoodLogScreen` wires this today, but the function itself does not
 * know that.
 */
export function useConsolidateMeal<T extends MealOwner>(
  apply: (change: (current: T) => T) => void,
): (meal: Meal, name: string, category: FoodCategory) => void {
  const repository = useFoodRepository();
  const toast = useToast();

  return useCallback(
    (meal: Meal, name: string, category: FoodCategory) => {
      const { totalGrams, per100g } = combinedMealTotals(meal);
      const parsed = customFoodSchema.safeParse({
        name,
        category,
        unit: "g",
        per100g,
      });

      if (!parsed.success) {
        toast(
          parsed.error.issues[0]?.message ??
            "Não foi possível transformar em alimento.",
        );
        return;
      }

      void (async () => {
        try {
          const food = createCustomFood(parsed.data);
          await (await repository).save(food, null);

          apply((current) =>
            consolidateMealItems(current, meal.id, [
              createMealItem({
                foodId: food.id,
                name: food.name,
                grams: totalGrams,
                unit: food.unit,
                per100g: food.per100g,
              }),
            ]),
          );

          toast(`${food.name} virou 1 alimento no catálogo.`, {
            label: "Desfazer",
            onAction: () => {
              apply((current) => undoConsolidateMealItems(current, meal.id));
            },
          });
        } catch (cause) {
          toast(describeDataError(cause));
        }
      })();
    },
    [apply, repository, toast],
  );
}
