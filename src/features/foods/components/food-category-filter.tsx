"use client";

import { cn } from "@/design-system/cn";

import { FOOD_CATEGORIES, FOOD_CATEGORY_LABELS, type FoodCategory } from "../types/food";

interface Props {
  readonly value: FoodCategory | null;
  readonly onChange: (category: FoodCategory | null) => void;
}

/**
 * Selecting the active category clears it, so narrowing and widening are the
 * same gesture — one tap either way, rather than a separate "all" button that
 * has to be hunted for.
 */
export function FoodCategoryFilter({ value, onChange }: Props) {
  return (
    <div
      role="group"
      aria-label="Filtrar por categoria"
      className="flex flex-wrap gap-2"
    >
      {FOOD_CATEGORIES.map((category) => {
        const active = value === category;

        return (
          <button
            key={category}
            type="button"
            aria-pressed={active}
            onClick={() => {
              onChange(active ? null : category);
            }}
            className={cn(
              "h-8 rounded-full border px-3.5 text-sm transition-colors duration-150 ease-out",
              active
                ? "border-accent bg-accent text-accent-ink"
                : "border-line bg-surface text-ink-muted hover:border-line-strong hover:text-ink",
            )}
          >
            {FOOD_CATEGORY_LABELS[category]}
          </button>
        );
      })}
    </div>
  );
}
