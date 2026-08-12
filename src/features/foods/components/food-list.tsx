import { Card } from "@/design-system/components/card";

import type { Food } from "../types/food";
import { FoodRow } from "./food-row";

interface Props {
  readonly foods: readonly Food[];
  readonly onToggleFavorite: (food: Food) => void;
  readonly onRemove: (food: Food) => void;
}

/**
 * The column header carries the units once so the rows do not repeat them.
 * Hidden from screen readers because it labels a list, not a table — each row
 * already reads out as a sentence.
 */
function ColumnHeader() {
  return (
    <div
      aria-hidden
      className="flex items-center gap-3 border-b border-line px-3 pb-2 text-[0.6875rem] font-medium tracking-wide text-ink-subtle uppercase"
    >
      <span className="w-8 shrink-0" />
      <span className="flex-1">Por 100 g</span>
      <span className="flex shrink-0 gap-3 sm:gap-4">
        <span className="w-11 text-right">kcal</span>
        <span className="w-9 text-right">Prot</span>
        <span className="w-9 text-right">Carb</span>
        <span className="w-9 text-right">Gord</span>
      </span>
      <span className="w-8 shrink-0" />
    </div>
  );
}

export function FoodList({ foods, onToggleFavorite, onRemove }: Props) {
  return (
    <Card padded={false} className="overflow-hidden">
      <div className="pt-3">
        <ColumnHeader />
      </div>

      <ul className="divide-y divide-line">
        {foods.map((food) => (
          <FoodRow
            key={food.id}
            food={food}
            onToggleFavorite={onToggleFavorite}
            onRemove={onRemove}
          />
        ))}
      </ul>
    </Card>
  );
}
