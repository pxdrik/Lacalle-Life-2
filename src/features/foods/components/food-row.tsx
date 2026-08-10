"use client";

import { Pencil, Star, Trash2 } from "lucide-react";
import Link from "next/link";

import { formatDecimal } from "@/core/format/decimal";
import { cn } from "@/design-system/cn";
import { ConfirmButton } from "@/design-system/components/confirm-button";

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

      <div className="flex shrink-0 items-baseline gap-3 text-sm tabular-nums sm:gap-4">
        <span className="w-11 text-right text-ink">{format(kcal)}</span>
        <span className="w-9 text-right text-protein">{format(proteinG)}</span>
        <span className="w-9 text-right text-carbs">{format(carbsG)}</span>
        <span className="w-9 text-right text-fat">{format(fatG)}</span>
      </div>

      {/* Only the user's own foods can be edited or deleted. The catalogue is
          shared ground and stays intact; unwanted entries are handled by
          search. */}
      <div className="flex w-16 shrink-0 justify-end">
        {food.isCustom && (
          <Link
            href={`/alimentos/${food.id}/editar`}
            aria-label={`Editar ${food.name}`}
            className={cn(
              "flex size-8 items-center justify-center rounded-md text-ink-subtle",
              "transition-colors duration-150 ease-out hover:bg-muted hover:text-ink",
              "opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100",
            )}
          >
            <Pencil aria-hidden className="size-4" />
          </Link>
        )}

        {food.isCustom && (
          <ConfirmButton
            onConfirm={() => {
              onRemove(food);
            }}
            label={`Excluir ${food.name}`}
            confirmLabel="Excluir?"
            className={cn(
              "h-8 min-w-8",
              // Revealed on hover for pointers, but always present for keyboard
              // and touch — hiding it behind hover would strand both.
              "opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100",
            )}
          >
            <Trash2 aria-hidden className="size-4" />
          </ConfirmButton>
        )}
      </div>
    </li>
  );
}

/** Whole numbers stay whole; only fractional values spend a decimal place. */
function format(value: number): string {
  return Number.isInteger(value)
    ? formatDecimal(value)
    : formatDecimal(value, 1);
}
