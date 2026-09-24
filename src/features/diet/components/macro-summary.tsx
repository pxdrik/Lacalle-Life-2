import type { Macros } from "@/core/domain/macros";
import { formatDecimal } from "@/core/format/decimal";
import { cn } from "@/design-system/cn";
import { MACRO_CODING } from "@/design-system/macros";

interface Props {
  readonly macros: Macros;
  readonly size?: "sm" | "lg";
  /**
   * `"inline"` (the default): each figure as "value unit", side by side,
   * wrapping onto a second line if they do not fit one — the compact line
   * every food row already used.
   *
   * `"stacked"`: value above its label, all four as equal columns on one
   * row that never wraps. For the meal's own total in `meal-card.tsx`
   * (achado real, 23/09/2026, print de referência do Pedro) — `"inline"`
   * at `size="lg"` put four "value unit" pairs, side by side, in a phone's
   * width: two tries to center that block both failed once it wrapped
   * ("3,5 Gord" stranded on its own line, off-centre). Stacking removes
   * the wrap risk altogether — a value's own column is only as wide as
   * the wider of the number and its short label, never the two side by
   * side — and centers each of the four by construction (`grid-cols-4`),
   * not by fighting a `flex-wrap` block that might break mid-row.
   */
  readonly layout?: "inline" | "stacked";
}

/**
 * Calories, then the three macros.
 *
 * Calories lead and carry no colour: they are the number people check first,
 * and the macros beside them are what the colours distinguish.
 */
export function MacroSummary({ macros, size = "sm", layout = "inline" }: Props) {
  const large = size === "lg";

  if (layout === "stacked") {
    return (
      <dl className="grid grid-cols-4 tabular-nums">
        <div className="text-center">
          <dd className="text-xl font-semibold text-ink">
            {formatDecimal(macros.kcal)}
          </dd>
          <dt className="mt-0.5 text-[0.6875rem] text-ink-subtle">kcal</dt>
        </div>

        {MACRO_CODING.map(({ key, short, text }) => (
          <div key={key} className="text-center">
            <dd className={cn("text-xl font-semibold", text)}>
              {formatDecimal(macros[key])}
            </dd>
            <dt className="mt-0.5 text-[0.6875rem] text-ink-subtle">{short}</dt>
          </div>
        ))}
      </dl>
    );
  }

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
          className={cn("text-ink", large ? "text-xl font-medium" : "text-sm")}
        >
          {formatDecimal(macros.kcal)}
        </dd>
        <dt
          className={cn(
            "text-ink-subtle",
            large ? "text-xs" : "text-[0.6875rem]",
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
