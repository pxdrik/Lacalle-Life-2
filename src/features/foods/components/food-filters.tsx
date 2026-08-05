"use client";

import { Star } from "lucide-react";

import { cn } from "@/design-system/cn";

import {
  FOOD_CATEGORIES,
  FOOD_CATEGORY_LABELS,
  type FoodCategory,
} from "../types/food";

interface Props {
  readonly category: FoodCategory | null;
  readonly favoritesOnly: boolean;
  readonly onCategoryChange: (category: FoodCategory | null) => void;
  readonly onFavoritesOnlyChange: (favoritesOnly: boolean) => void;
}

const CHIP =
  "h-8 rounded-full border px-3.5 text-sm transition-colors duration-150 ease-out";
const CHIP_ON = "border-accent bg-accent text-accent-ink";
const CHIP_OFF =
  "border-line bg-surface text-ink-muted hover:border-line-strong hover:text-ink";

/**
 * Every chip toggles: pressing the active one clears it, so narrowing and
 * widening are the same gesture. One tap either way, and no separate "all"
 * button to hunt for.
 */
export function FoodFilters({
  category,
  favoritesOnly,
  onCategoryChange,
  onFavoritesOnlyChange,
}: Props) {
  return (
    <div
      role="group"
      aria-label="Filtros"
      className="flex flex-wrap items-center gap-2"
    >
      <button
        type="button"
        aria-pressed={favoritesOnly}
        onClick={() => {
          onFavoritesOnlyChange(!favoritesOnly);
        }}
        className={cn(
          CHIP,
          "inline-flex items-center gap-1.5",
          favoritesOnly ? CHIP_ON : CHIP_OFF,
        )}
      >
        <Star
          aria-hidden
          className="size-3.5"
          fill={favoritesOnly ? "currentColor" : "none"}
        />
        Favoritos
      </button>

      <span aria-hidden className="mx-0.5 h-5 w-px bg-line" />

      {FOOD_CATEGORIES.map((option) => {
        const active = category === option;

        return (
          <button
            key={option}
            type="button"
            aria-pressed={active}
            onClick={() => {
              onCategoryChange(active ? null : option);
            }}
            className={cn(CHIP, active ? CHIP_ON : CHIP_OFF)}
          >
            {FOOD_CATEGORY_LABELS[option]}
          </button>
        );
      })}
    </div>
  );
}
