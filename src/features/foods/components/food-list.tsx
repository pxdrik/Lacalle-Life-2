import type { Food } from "../types/food";
import { FoodRow } from "./food-row";

/**
 * The column header carries the units once so the rows do not repeat them.
 * Hidden from screen readers because it labels a list, not a table — the row
 * itself reads out as a sentence.
 */
function ColumnHeader() {
  return (
    <div
      aria-hidden
      className="flex items-center gap-4 border-b border-line px-4 pb-2 text-[0.6875rem] font-medium tracking-wide text-ink-subtle uppercase"
    >
      <span className="flex-1">Por 100 g</span>
      <span className="flex shrink-0 gap-3 sm:gap-4">
        <span className="w-12 text-right">kcal</span>
        <span className="w-10 text-right">Prot</span>
        <span className="w-10 text-right">Carb</span>
        <span className="w-10 text-right">Gord</span>
      </span>
    </div>
  );
}

export function FoodList({ foods }: { readonly foods: readonly Food[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface">
      <div className="pt-3">
        <ColumnHeader />
      </div>

      <ul className="divide-y divide-line">
        {foods.map((food) => (
          <FoodRow key={food.id} food={food} />
        ))}
      </ul>
    </div>
  );
}
