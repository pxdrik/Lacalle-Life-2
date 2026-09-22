import {
  createEntityId,
  entityTimestamp,
  revise,
  type EntityId,
} from "@/core/domain/entity";
import { sumMacros, type Macros } from "@/core/domain/macros";

import { mealMacros } from "./diet-macros";
import type { Diet, Meal } from "../types/diet";
import type { FoodLog } from "../types/food-log";

/**
 * "Comi esta refeição" — the bridge between a plan and what happened.
 *
 * A check does not copy the meal into the log on every click, and it is not
 * a live link either: it takes one snapshot, the moment it is first checked,
 * the same way `startDayFromDiet` takes one snapshot of the whole diet.
 * Editing the diet afterwards — a corrected portion, a renamed meal — must
 * not reach into a day already recorded, for the same reason
 * `startDayFromDiet` mints fresh ids at every depth: the two have to share
 * no reference at all for that independence to be structural rather than a
 * rule to remember.
 *
 * Identity is `sourceDietId` + `sourceMealId`, both stamped on the copy and
 * never on a `Diet`'s own meals. That pair is what makes "is this in today's
 * log at all" (`isMealLogged`) and "was it actually eaten" (`isMealEaten`)
 * two different questions the Diário can ask of a day's log — a meal
 * `startDayFromDiet` seeds is logged the instant the day starts, whether or
 * not it has been checked yet, which is the whole point: every planned meal
 * stays visible and editable in the Diário all day, and checking it never
 * makes it disappear again.
 */

/** Finds the log's own copy of one diet meal, if the day has one at all. */
function findLoggedMeal(
  log: FoodLog,
  dietId: EntityId,
  mealId: EntityId,
): Meal | undefined {
  return log.meals.find(
    (meal) => meal.sourceDietId === dietId && meal.sourceMealId === mealId,
  );
}

/**
 * `false`, never absence, is what marks a meal not yet eaten — see the note
 * on `Meal.eaten`. This is the one place allowed to read the field directly;
 * everywhere else calls this or `isMealEaten` instead of re-deriving the
 * same "undefined means legacy-true" rule.
 */
function isEaten(meal: Meal): boolean {
  return meal.eaten !== false;
}

/** Whether a copy of this diet meal exists in the day's log at all — eaten or not. */
export function isMealLogged(
  log: FoodLog,
  dietId: EntityId,
  mealId: EntityId,
): boolean {
  return findLoggedMeal(log, dietId, mealId) !== undefined;
}

/** Whether this diet meal has actually been eaten today. */
export function isMealEaten(
  log: FoodLog,
  dietId: EntityId,
  mealId: EntityId,
): boolean {
  const meal = findLoggedMeal(log, dietId, mealId);
  return meal !== undefined && isEaten(meal);
}

/**
 * One snapshot of a diet meal, minted fresh at every depth — the same
 * independence `startDayFromDiet` documents at the top of this file, shared
 * here because `checkMeal` and `openMeal` are the same copy with a different
 * `eaten`.
 */
function snapshotMeal(diet: Diet, meal: Meal, eaten: boolean): Meal {
  const items = meal.items.map((item) => ({ ...item, id: createEntityId() }));

  return {
    id: createEntityId(),
    name: meal.name,
    time: meal.time,
    notes: meal.notes,
    items,
    sourceDietId: diet.id,
    sourceMealId: meal.id,
    // The same array as `items`, not a second copy of it — see
    // `mealCheckState` below, which is what this pays for.
    plannedSnapshot: items,
    eaten,
    // Appended to the log, so this always sorts after whatever is already
    // there — see `Meal.order`.
    order: entityTimestamp(),
  };
}

/**
 * Marks a diet meal eaten.
 *
 * If the day never had a copy of this meal at all — checking one straight
 * from a plan that was never started — this is where the one snapshot gets
 * taken. If the day already has one, seeded unchecked by `startDayFromDiet`
 * or checked and later unchecked, this only flips the flag: the meal keeps
 * whatever items it already has, edited or not, and keeps its id.
 */
export function checkMeal(log: FoodLog, diet: Diet, meal: Meal): FoodLog {
  const existing = findLoggedMeal(log, diet.id, meal.id);

  if (existing !== undefined) {
    if (isEaten(existing)) return log;

    return revise(log, {
      meals: log.meals.map((candidate) =>
        candidate === existing ? { ...candidate, eaten: true } : candidate,
      ),
    });
  }

  return revise(log, { meals: [...log.meals, snapshotMeal(diet, meal, true)] });
}

/**
 * Pulls a planned meal into today's log to look at or adjust, without
 * claiming it was eaten — tapping the compact row in `PlannedMeals`, not its
 * check button.
 *
 * Achado real, 17/09/2026: o único jeito de ver ou editar uma refeição
 * planejada era marcá-la como comida primeiro, o que descrevia uma refeição
 * ainda não feita como já concluída. A mesma foto que `checkMeal` tira
 * quando a refeição ainda não está no dia, só que `eaten: false` — o mesmo
 * estado que `startDayFromDiet` já deixa toda refeição de um dia recém
 * começado, editável e visível sem exigir um check antes.
 *
 * A no-op, same reference, once the meal is already logged either way —
 * opening something already open does nothing, and never demotes an
 * already-eaten meal back to unchecked.
 */
export function openMeal(log: FoodLog, diet: Diet, meal: Meal): FoodLog {
  if (isMealLogged(log, diet.id, meal.id)) return log;

  return revise(log, {
    meals: [...log.meals, snapshotMeal(diet, meal, false)],
  });
}

/**
 * `openMeal`'s undo — drops the snapshot, returning the meal to the compact
 * "Planejado" row instead of the full card.
 *
 * Pedro, 17/09/2026, olhando uma refeição que `openMeal` tinha acabado de
 * trazer pra tela: "vamos fazer uma funcionalidade para voltar a 'fechar' o
 * card do diário." Só faz sentido pra uma refeição ainda não comida — a
 * cópia existe exatamente pra ler ou ajustar antes de decidir, e fechar sem
 * ter decidido nada não deveria custar nada. Fechar uma já comida apagaria
 * um registro real, então isto é um no-op nesse caso (mesma regra de
 * `uncheckMeal`: nunca reverte "comido" sozinho) — a pessoa usa o check pra
 * desmarcar primeiro se for isso que quer.
 */
export function closeMeal(
  log: FoodLog,
  dietId: EntityId,
  mealId: EntityId,
): FoodLog {
  const existing = findLoggedMeal(log, dietId, mealId);
  if (existing === undefined || isEaten(existing)) return log;

  return revise(log, {
    meals: log.meals.filter((candidate) => candidate !== existing),
  });
}

export type MealCheckState = "unchecked" | "checked" | "edited";

/**
 * `"unchecked"`, `"checked"`, or `"edited"` — the third state nobody sets on
 * purpose. Every `edit-diet.ts` operation replaces `items` with a new array
 * rather than mutating one in place, so a meal whose `items` still *is*
 * (`===`) the array it was checked with has not been touched since; any edit
 * in the Diário — a portion changed, a food swapped — necessarily produces a
 * different array, and reference equality is exactly the question "does this
 * still match what was checked".
 */
export function mealCheckState(
  log: FoodLog,
  dietId: EntityId,
  mealId: EntityId,
): MealCheckState {
  const meal = findLoggedMeal(log, dietId, mealId);
  if (meal === undefined || !isEaten(meal)) return "unchecked";

  return meal.items === meal.plannedSnapshot ? "checked" : "edited";
}

/**
 * Marks a diet meal not eaten, without removing it from the day.
 *
 * The meal used to be deleted from `log.meals` outright, which is exactly
 * the bug this was rewritten for: a day starts with every planned meal
 * already in the Diário (`startDayFromDiet` seeds them unchecked, not
 * pre-checked), so unchecking one must leave it in place — otherwise it
 * silently drops off the one screen meant to show what is still left to do
 * today. A no-op, same reference, when the meal is not logged or is already
 * unchecked.
 */
export function uncheckMeal(
  log: FoodLog,
  dietId: EntityId,
  mealId: EntityId,
): FoodLog {
  const existing = findLoggedMeal(log, dietId, mealId);
  if (existing === undefined || !isEaten(existing)) return log;

  return revise(log, {
    meals: log.meals.map((candidate) =>
      candidate === existing ? { ...candidate, eaten: false } : candidate,
    ),
  });
}

/** Checks `meal` if it is not eaten yet, unchecks it if it is. */
export function toggleMealChecked(
  log: FoodLog,
  diet: Diet,
  meal: Meal,
): FoodLog {
  return isMealEaten(log, diet.id, meal.id)
    ? uncheckMeal(log, diet.id, meal.id)
    : checkMeal(log, diet, meal);
}

/**
 * The same toggle, by id pair alone.
 *
 * For a caller that is already looking at a logged meal — the Diário's own
 * meal list, which only ever renders one once it exists in `log.meals` — and
 * so has no reason to hold the source `Diet` (which may not even be the
 * weekday's linked one) or the diet's own `Meal` object just to flip a flag
 * on a copy that already exists. A no-op if the pair is not logged at all;
 * `checkMeal`/`toggleMealChecked` are what turn an unlogged plan meal into
 * one, and need the full objects for exactly that reason.
 */
export function toggleLoggedMeal(
  log: FoodLog,
  dietId: EntityId,
  mealId: EntityId,
): FoodLog {
  const existing = findLoggedMeal(log, dietId, mealId);
  if (existing === undefined) return log;
  if (isEaten(existing)) return uncheckMeal(log, dietId, mealId);

  return revise(log, {
    meals: log.meals.map((candidate) =>
      candidate === existing ? { ...candidate, eaten: true } : candidate,
    ),
  });
}

/**
 * The meals that count toward today's totals.
 *
 * Everything in `log.meals` is visible in the Diário the moment the day
 * starts, eaten or not — but a food log's whole point is recording what
 * actually happened, so anything still unchecked must stay out of "Hoje"'s
 * calorie ring and out of `TodayMeals`' list. Both read this instead of
 * `log.meals` directly, so they cannot drift apart on what "eaten" means.
 */
export function eatenMeals(log: FoodLog): readonly Meal[] {
  return log.meals.filter(isEaten);
}

export function eatenMacros(log: FoodLog): Macros {
  return sumMacros(eatenMeals(log).map(mealMacros));
}
