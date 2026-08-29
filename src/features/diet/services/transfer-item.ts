import { createEntityId, type EntityId } from "@/core/domain/entity";
import { describeDataError } from "@/core/domain/describe-data-error";

import type { DietRepository } from "../data/diet-repository";
import type { MealItem } from "../types/diet";
import { addItem } from "./edit-diet";

export type TransferResult = { readonly ok: true } | { readonly ok: false; readonly message: string };

/**
 * Puts a copy of `item` into a meal of a *different* diet than the one being
 * edited right now.
 *
 * Every other move/copy in this feature (`copyItemToMeal`, `moveItemToMeal`
 * in `edit-diet.ts`) is a pure function of the one diet already held in
 * memory — that is what lets `useDietEditor`'s `apply` stay synchronous and
 * optimistic. Sending an item to a second diet cannot work that way: that
 * diet is a different document, possibly being edited in another tab right
 * now, so this reads it fresh rather than trusting a copy from whenever the
 * picker's list was loaded, and saves through the same optimistic-concurrency
 * path every other write in this app uses.
 *
 * Deliberately not atomic with removing the item from the source diet — two
 * separate documents cannot be written as one transaction here. The caller
 * (`onSendItem` in `diet-editor.tsx`/`food-log-screen.tsx`) is why this
 * matters: it only removes from the source *after* this succeeds, so a
 * failure here leaves the food where it was, and a failure on the source
 * side after this succeeds leaves it duplicated rather than gone. Duplicated
 * and visible beats silently lost.
 */
export async function transferItemToDiet(
  repository: DietRepository,
  targetDietId: EntityId,
  targetMealId: EntityId,
  item: MealItem,
): Promise<TransferResult> {
  try {
    const target = await repository.getById(targetDietId);
    // The diet (or, inside `addItem`, the meal) was deleted since the picker
    // listed it — the same "stale reference is a no-op" rule every other
    // operation in `edit-diet.ts` already follows, not a new one.
    if (target === undefined) return { ok: true };

    const updated = addItem(target, targetMealId, {
      ...item,
      id: createEntityId(),
    });
    if (updated === target) return { ok: true };

    await repository.save(updated, target.updatedAt);
    return { ok: true };
  } catch (error) {
    return { ok: false, message: describeDataError(error) };
  }
}
