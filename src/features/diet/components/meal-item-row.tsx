"use client";

import { GripVertical, X } from "lucide-react";

import { formatDecimal } from "@/core/format/decimal";
import { cn } from "@/design-system/cn";
import { MACRO_CODING } from "@/design-system/macros";

import { itemMacros } from "../services/diet-macros";
import type { MealItem } from "../types/diet";

interface Props {
  readonly item: MealItem;
  readonly dragHandle: {
    readonly attributes: React.HTMLAttributes<HTMLElement>;
    readonly listeners: Record<string, unknown> | undefined;
    readonly isDragging: boolean;
  };
  readonly otherMeals: readonly {
    readonly id: string;
    readonly name: string;
  }[];
  readonly onGramsChange: (grams: number) => void;
  readonly onRemove: () => void;
  readonly onSend: (targetMealId: string, mode: "copy" | "move") => void;
}

/**
 * One food inside a meal.
 *
 * Grams are a live input rather than something behind an edit affordance —
 * adjusting a portion is the single most repeated action in building a diet,
 * and the macros beside it move as you type.
 */
export function MealItemRow({
  item,
  dragHandle,
  otherMeals,
  onGramsChange,
  onRemove,
  onSend,
}: Props) {
  const macros = itemMacros(item);

  return (
    <li
      className={cn(
        // Wraps on a phone: seven controls in one line need ~290px and a
        // 360px screen leaves the row about 250, so it used to run off the
        // card. Below `sm` the portion stays with the name and the numbers
        // take a second line.
        "group flex flex-wrap items-center gap-x-2 gap-y-1 py-1.5 sm:flex-nowrap sm:gap-2",
        dragHandle.isDragging && "rounded-sm bg-muted",
      )}
    >
      {/* Only within a meal, and only by dragging: the order of foods inside a
          meal is cosmetic, and two arrow buttons per row would cost more than
          the reordering is worth. The keyboard sensor still covers it. */}
      <button
        type="button"
        aria-label={`Reordenar ${item.name}`}
        {...dragHandle.attributes}
        {...dragHandle.listeners}
        className="flex size-6 shrink-0 cursor-grab touch-none items-center justify-center touch-44 rounded-full text-ink-subtle/60 transition-colors duration-150 ease-out hover:text-ink active:cursor-grabbing"
      >
        <GripVertical aria-hidden className="size-3.5" />
      </button>

      <span className="min-w-0 flex-1 truncate text-sm text-ink">
        {item.name}
      </span>

      <div className="flex shrink-0 items-center gap-1">
        <input
          type="text"
          inputMode="numeric"
          value={item.grams === 0 ? "" : String(item.grams)}
          aria-label={`Gramas de ${item.name}`}
          placeholder="0"
          onChange={(event) => {
            onGramsChange(toGrams(event.target.value));
          }}
          className="w-14 rounded-md border border-line bg-surface px-2 py-1 text-right text-sm tabular-nums transition-colors duration-150 ease-out hover:border-line-strong"
        />
        <span className="text-xs text-ink-subtle">g</span>
      </div>

      {/* Forces the wrap here and nowhere else. A zero-height item with a
          full-width basis cannot share a line, so everything after it lands on
          the second row together — the alternative is letting flex choose, and
          flex breaks wherever the longest name happens to leave off. */}
      <div aria-hidden className="basis-full sm:hidden" />

      {/* `ms-auto` pins the numbers to the right edge of the wrapped line, so
          they stay in a column across items instead of drifting with the
          width of each name. */}
      <div className="ms-auto flex w-40 shrink-0 items-baseline justify-end gap-3 text-xs tabular-nums sm:w-48 sm:gap-4">
        <span className="text-ink-muted">{formatDecimal(macros.kcal)}</span>
        {MACRO_CODING.map(({ key, text }) => (
          <span key={key} className={text}>
            {formatDecimal(macros[key])}
          </span>
        ))}
      </div>

      {/* A native select rather than a custom menu: it is keyboard operable,
          it opens the OS picker on a phone, and it costs one control instead
          of two buttons on an already dense row. Hidden when there is nowhere
          to send the food. */}
      {otherMeals.length > 0 && (
        <select
          value=""
          aria-label={`Mover ou copiar ${item.name} para outra refeição`}
          onChange={(event) => {
            const [mode, mealId] = event.target.value.split(":");
            if (mode === undefined || mealId === undefined) return;
            onSend(mealId, mode === "copy" ? "copy" : "move");
          }}
          className="w-7 shrink-0 rounded-md border border-transparent bg-transparent text-xs text-ink-subtle transition-colors duration-150 ease-out hover:border-line hover:text-ink"
        >
          <option value="">⋯</option>
          <optgroup label="Mover para">
            {otherMeals.map((meal) => (
              <option key={`move:${meal.id}`} value={`move:${meal.id}`}>
                {meal.name}
              </option>
            ))}
          </optgroup>
          <optgroup label="Copiar para">
            {otherMeals.map((meal) => (
              <option key={`copy:${meal.id}`} value={`copy:${meal.id}`}>
                {meal.name}
              </option>
            ))}
          </optgroup>
        </select>
      )}

      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remover ${item.name}`}
        className="flex size-7 shrink-0 items-center justify-center touch-44 rounded-full text-ink-subtle transition-colors duration-150 ease-out hover:bg-danger/10 hover:text-danger sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
      >
        <X aria-hidden className="size-3.5" />
      </button>
    </li>
  );
}

/**
 * Digits only, and never negative. A portion is a physical quantity, so the
 * field refuses nonsense at entry instead of validating it afterwards.
 */
function toGrams(input: string): number {
  const digits = input.replace(/\D/g, "");
  if (digits === "") return 0;

  // Guards against a pasted number so long it stops being a number.
  return Math.min(Number(digits), 100_000);
}
