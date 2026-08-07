import type { Entity, EntityId } from "@/core/domain/entity";

import type { Meal } from "./diet";

/**
 * What was eaten on one day.
 *
 * **A diet is the plan; this is what happened.** The same split as Routine and
 * Session, and for the same reason: a plan gets edited freely, and a record of
 * a Tuesday must not change because the plan changed on Friday.
 *
 * Until this existed the app could only plan. A diet had no date, so nothing
 * ever recorded that Tuesday's lunch was rice and Wednesday's was not — which
 * left the whole nutrition half unable to answer the only question people open
 * these apps to ask.
 *
 * **The id is the day**, exactly as in the body log: you eat one Tuesday, and
 * making the date the identity removes a class of duplicate that would
 * otherwise need checking for. It also sorts chronologically as plain text.
 *
 * It carries `meals` — the same `Meal` the diet carries — so every meal
 * operation and `MealCard` work on it unchanged.
 */
export interface FoodLog extends Entity {
  /** Local calendar day, `YYYY-MM-DD`. The same value as `id`. */
  readonly day: string;

  readonly meals: readonly Meal[];

  /**
   * The diet this day was started from, when it was.
   *
   * A reference for "how often do I actually follow the plan", never a live
   * link: the meals below are a copy, and editing the diet cannot reach them.
   * `null` for a day built by hand.
   */
  readonly dietId: EntityId | null;
}

/** Whether the day records anything at all. */
export function isEmptyLog(log: FoodLog): boolean {
  return log.meals.every((meal) => meal.items.length === 0);
}
