import type { Macros } from "@/core/domain/macros";
import { formatDecimal } from "@/core/format/decimal";
import { cn } from "@/design-system/cn";
import { MACRO_CODING } from "@/design-system/macros";

interface Props {
  readonly macros: Macros;
  readonly size?: "sm" | "lg";
  /**
   * Kcal alone reads bigger than Prot/Carb/Gord beside it, regardless of
   * `size`. Exists for the meal's own total in `meal-card.tsx` (achado
   * real, 23/09/2026): bumping all four figures to `size="lg"` there
   * wrapped the row onto two lines on a phone — "192 kcal 7 Prot 32,3
   * Carb" on one line, "3,5 Gord" stranded on its own below, and the whole
   * block read as too big for a line inside a meal card rather than
   * distinct from it. Only kcal needs to outweigh the food rows beneath
   * it; the three macros can stay exactly the size they already were.
   */
  readonly emphasizeKcal?: boolean;
}

/**
 * Calories, then the three macros.
 *
 * Calories lead and carry no colour: they are the number people check first,
 * and the macros beside them are what the colours distinguish.
 */
export function MacroSummary({
  macros,
  size = "sm",
  emphasizeKcal = false,
}: Props) {
  const large = size === "lg";
  const bigKcal = large || emphasizeKcal;

  return (
    <dl
      className={cn(
        // Wraps rather than pushing past the card. On a 320px screen the meal
        // header puts these four figures beside four buttons in ~250px, and
        // "2.023 kcal 83 Prot 316 Carb 40 Gord" does not fit on one line — it
        // used to overflow by ~32px and drag the page into sideways scroll.
        "flex flex-wrap items-baseline tabular-nums",
        large ? "gap-x-5 gap-y-1" : "gap-x-3.5 gap-y-0.5",
      )}
    >
      <div className="flex items-baseline gap-1">
        <dd
          className={cn(
            "text-ink",
            bigKcal ? "text-xl font-medium" : "text-sm",
          )}
        >
          {formatDecimal(macros.kcal)}
        </dd>
        <dt
          className={cn(
            "text-ink-subtle",
            bigKcal ? "text-xs" : "text-[0.6875rem]",
          )}
        >
          kcal
        </dt>
      </div>

      {MACRO_CODING.map(({ key, short, text }) => (
        <div key={key} className="flex items-baseline gap-1">
          <dd className={cn(text, large ? "text-xl font-medium" : "text-sm")}>
            {formatDecimal(macros[key])}
          </dd>
          <dt
            className={cn(
              "text-ink-subtle",
              large ? "text-xs" : "text-[0.6875rem]",
            )}
          >
            {short}
          </dt>
        </div>
      ))}
    </dl>
  );
}
