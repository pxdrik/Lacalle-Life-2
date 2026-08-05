"use client";

import { Star, Trash2 } from "lucide-react";

import { cn } from "@/design-system/cn";

import type { Food } from "../types/food";
import { FOOD_CATEGORY_LABELS } from "../types/food";

interface Props {
  readonly food: Food;
  readonly onToggleFavorite: (food: Food) => void;
  readonly onRemove: (food: Food) => void;
}

/**
 * One catalogue row.
 *
 * Values are per 100 g and the column header says so once, so each row does
 * not repeat the unit four times. Macros use the data colours — the only place
 * in the app where colour appears for its own sake, and here it works as a
 * legend.
 */
export function FoodRow({ food, onToggleFavorite, onRemove }: Props) {
  const { kcal, proteinG, carbsG, fatG } = food.per100g;

  return (
    <li className="group flex items-center gap-3 px-3 py-2.5 transition-colors duration-100 ease-out hover:bg-muted">
      <button
        type="button"
        onClick={() => {
          onToggleFavorite(food);
        }}
        aria-pressed={food.isFavorite}
        aria-label={
          food.isFavorite
            ? `Remover ${food.name} dos favoritos`
            : `Favoritar ${food.name}`
        }
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-md",
          "transition-colors duration-150 ease-out hover:bg-line",
          food.isFavorite ? "text-ink" : "text-ink-subtle/50",
        )}
      >
        <Star
          aria-hidden
          className="size-4"
          fill={food.isFavorite ? "currentColor" : "none"}
        />
      </button>

      <div className="min-w-0 flex-1">
        <p className="truncate text-[0.9375rem] text-ink">{food.name}</p>
        <p className="mt-0.5 text-xs text-ink-subtle">
          {FOOD_CATEGORY_LABELS[food.category]}
          {food.isCustom && " · seu alimento"}
        </p>
      </div>

      <div className="flex shrink-0 items-baseline gap-3 font-mono text-sm tabular-nums sm:gap-4">
        <span className="w-11 text-right text-ink">{format(kcal)}</span>
        <span className="w-9 text-right text-protein">{format(proteinG)}</span>
        <span className="w-9 text-right text-carbs">{format(carbsG)}</span>
        <span className="w-9 text-right text-fat">{format(fatG)}</span>
      </div>

      {/* Only the user's own foods can be deleted. The catalogue is shared
          ground and stays intact; unwanted entries are handled by search. */}
      <div className="w-8 shrink-0">
        {food.isCustom && (
          <button
            type="button"
            onClick={() => {
              onRemove(food);
            }}
            aria-label={`Excluir ${food.name}`}
            className={cn(
              "flex size-8 items-center justify-center rounded-md text-ink-subtle",
              "transition-colors duration-150 ease-out",
              "hover:bg-danger/10 hover:text-danger",
              // Revealed on hover for pointers, but always present for keyboard
              // and touch — hiding it behind hover would strand both.
              "opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100",
            )}
          >
            <Trash2 aria-hidden className="size-4" />
          </button>
        )}
      </div>
    </li>
  );
}

/** Whole numbers stay whole; only fractional values spend a decimal place. */
function format(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
