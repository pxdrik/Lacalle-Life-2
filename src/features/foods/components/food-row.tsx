import type { Food } from "../types/food";
import { FOOD_CATEGORY_LABELS } from "../types/food";

/**
 * One catalogue row.
 *
 * Values are per 100 g and the header says so once, so each row does not
 * repeat the unit four times. Macros use the data colours, which is the only
 * place in the app colour appears for its own sake — here it is a legend.
 */
export function FoodRow({ food }: { readonly food: Food }) {
  const { kcal, proteinG, carbsG, fatG } = food.per100g;

  return (
    <li className="flex items-center gap-4 px-4 py-3 transition-colors duration-100 ease-out hover:bg-muted">
      <div className="min-w-0 flex-1">
        <p className="truncate text-[0.9375rem] text-ink">{food.name}</p>
        <p className="mt-0.5 text-xs text-ink-subtle">
          {FOOD_CATEGORY_LABELS[food.category]}
        </p>
      </div>

      <div className="flex shrink-0 items-baseline gap-3 font-mono text-sm tabular-nums sm:gap-4">
        <span className="w-12 text-right text-ink">{format(kcal)}</span>
        <span className="w-10 text-right text-protein">{format(proteinG)}</span>
        <span className="w-10 text-right text-carbs">{format(carbsG)}</span>
        <span className="w-10 text-right text-fat">{format(fatG)}</span>
      </div>
    </li>
  );
}

/** Whole numbers stay whole; only fractional values spend a decimal place. */
function format(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
