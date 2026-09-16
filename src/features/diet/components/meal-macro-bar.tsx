import type { Macros } from "@/core/domain/macros";
import { formatDecimal } from "@/core/format/decimal";
import { cn } from "@/design-system/cn";
import { MACRO_CODING } from "@/design-system/macros";

interface Props {
  readonly macros: Macros;
  readonly className?: string;
}

/**
 * A meal's macros as one thin bar instead of four spelled-out figures.
 *
 * `MealCard`'s header used to carry "kcal · Prot · Carb · Gord" in full —
 * four numbers and four units repeated on every meal in a diet dense enough
 * to have a dozen. The kcal figure is the one number worth reading at this
 * size; protein, carbohydrate and fat become one glance at their relative
 * share instead, drawn in the same three hues `MacroProgress` already uses
 * for a target's bars — same colour coding, no target here to compare
 * against, so it is proportion within the meal rather than progress toward
 * anything.
 *
 * Proportioned by grams, not calories: converting to kcal here would mean
 * quietly applying Atwater factors (4/4/9) this codebase otherwise avoids —
 * `Macros.kcal` is deliberately the measured value, never derived from the
 * other three (see `core/domain/macros.ts`). A gram share is an honest
 * "which of these three is biggest", not a second, invented calorie count.
 */
export function MealMacroBar({ macros, className }: Props) {
  const total = macros.proteinG + macros.carbsG + macros.fatG;

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span className="shrink-0 text-sm tabular-nums text-ink">
        {formatDecimal(Math.round(macros.kcal))}
        <span className="ml-1 text-xs text-ink-subtle">kcal</span>
      </span>

      <div
        className="h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-muted sm:w-20"
        role="img"
        aria-label={MACRO_CODING.map(
          ({ key, short }) => `${short} ${formatDecimal(macros[key])}g`,
        ).join(", ")}
      >
        {total > 0 && (
          <div className="flex h-full w-full">
            {MACRO_CODING.map(({ key, fill }) => {
              const share = macros[key] / total;
              if (share <= 0) return null;

              return (
                <div
                  key={key}
                  style={{ width: `${String(share * 100)}%` }}
                  className={fill}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
