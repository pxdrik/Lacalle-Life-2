import type { Macros } from "@/core/domain/macros";
import { formatDecimal } from "@/core/format/decimal";
import { KCAL_PER_GRAM } from "@/core/nutrition";
import { cn } from "@/design-system/cn";
import { MACRO_CODING, type MacroKey } from "@/design-system/macros";

const SIZE = 128;
const CENTER = SIZE / 2;
const RADIUS = 46;
const STROKE = 18;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const KCAL_KEY: Record<MacroKey, keyof typeof KCAL_PER_GRAM> = {
  proteinG: "protein",
  carbsG: "carbs",
  fatG: "fat",
};

const STROKE_CLASS: Record<MacroKey, string> = {
  proteinG: "stroke-protein",
  carbsG: "stroke-carbs",
  fatG: "stroke-fat",
};

/**
 * The macro split, drawn — Pedro, 24/09/2026, after seeing the reference
 * app's "Goals" screen: "a distribuição vamos fazer o gráfico, igual mandei
 * em imagem. Vai ficar mais fácil do usuário enxergar."
 *
 * Reverses the "no chart" call `macro-split-dialog.tsx` makes for itself —
 * that one still holds for the *picker*, which the reference app also draws
 * as a plain list; the donut belongs on the *summary*, exactly where the
 * reference draws one too.
 *
 * Reads shares straight from the plan's own `targets` grams, converted to
 * kcal — correct whether the split came from a preset, a custom entry, or
 * the automatic algorithm, with nothing here re-deciding a percentage
 * `distribution.ts` already owns.
 *
 * `aria-hidden`, same as `CalorieRing`: the grams-and-label grid this sits
 * beside already carries the real information to a screen reader, in the
 * same three colours (`MACRO_CODING`) — this is the visual reinforcement,
 * not a second source of it.
 */
export function MacroDonut({
  macros,
  className,
}: {
  readonly macros: Macros;
  readonly className?: string;
}) {
  const totalKcal =
    macros.proteinG * KCAL_PER_GRAM.protein +
    macros.carbsG * KCAL_PER_GRAM.carbs +
    macros.fatG * KCAL_PER_GRAM.fat;

  // Two passes rather than a running total mutated across iterations: each
  // slice's length depends only on its own share, and its start is the sum
  // of every share before it — a pure lookup, not state carried forward.
  const shares = MACRO_CODING.map((macro) => {
    const kcal = macros[macro.key] * KCAL_PER_GRAM[KCAL_KEY[macro.key]];
    const fraction = totalKcal > 0 ? kcal / totalKcal : 0;
    return { macro, fraction, length: fraction * CIRCUMFERENCE };
  });

  const arcs = shares.map((share, index) => {
    const start = shares
      .slice(0, index)
      .reduce((sum, prior) => sum + prior.length, 0);
    const midAngleRad =
      ((start + share.length / 2) / CIRCUMFERENCE) * 2 * Math.PI -
      Math.PI / 2;

    return { ...share, start, midAngleRad };
  });

  return (
    <svg
      aria-hidden
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      className={cn("shrink-0", className)}
    >
      <circle
        cx={CENTER}
        cy={CENTER}
        r={RADIUS}
        fill="none"
        strokeWidth={STROKE}
        className="stroke-muted"
      />
      {arcs.map(
        ({ macro, length, start, fraction }) =>
          fraction > 0 && (
            <circle
              key={macro.key}
              cx={CENTER}
              cy={CENTER}
              r={RADIUS}
              fill="none"
              strokeWidth={STROKE}
              strokeDasharray={`${length} ${CIRCUMFERENCE - length}`}
              strokeDashoffset={-start}
              transform={`rotate(-90 ${CENTER} ${CENTER})`}
              className={STROKE_CLASS[macro.key]}
            />
          ),
      )}
      {arcs.map(
        ({ macro, fraction, midAngleRad }) =>
          // A slice too thin to hold its own number would just print digits
          // on top of the next slice — skipped rather than crowded.
          fraction >= 0.08 && (
            <text
              key={macro.key}
              x={CENTER + RADIUS * Math.cos(midAngleRad)}
              y={CENTER + RADIUS * Math.sin(midAngleRad)}
              textAnchor="middle"
              dominantBaseline="central"
              className="fill-white text-[11px] font-semibold tabular-nums"
            >
              {formatDecimal(Math.round(fraction * 100))}%
            </text>
          ),
      )}
    </svg>
  );
}
