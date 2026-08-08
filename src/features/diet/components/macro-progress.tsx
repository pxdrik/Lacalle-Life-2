import type { Macros } from "@/core/domain/macros";
import { formatDecimal } from "@/core/format/decimal";
import { cn } from "@/design-system/cn";

interface Props {
  readonly totals: Macros;
  readonly targets: Macros;
}

const BARS = [
  { key: "kcal", label: "kcal", fill: "bg-ink", unit: "" },
  { key: "proteinG", label: "Prot", fill: "bg-protein", unit: "g" },
  { key: "carbsG", label: "Carb", fill: "bg-carbs", unit: "g" },
  { key: "fatG", label: "Gord", fill: "bg-fat", unit: "g" },
] as const;

/**
 * How the diet compares to the profile's targets.
 *
 * Only rendered when a profile exists. Building a diet never depends on
 * having one, so this is an overlay on information that was already complete —
 * never a prerequisite for it.
 *
 * Values are announced as text as well as drawn, because a bar alone tells a
 * screen reader nothing.
 */
export function MacroProgress({ totals, targets }: Props) {
  return (
    // Two columns on a phone. Four of these never fit a 360px screen — a
    // column gets ~70px and "1.256/2.220" needs ~90 — so the calorie figure
    // used to run under the protein one. Four across from `sm`, where there is
    // room for a single glanceable line.
    <dl className="grid grid-cols-2 gap-x-5 gap-y-3 sm:grid-cols-4 sm:gap-3">
      {BARS.map(({ key, label, fill, unit }) => {
        const value = totals[key];
        const target = targets[key];
        const ratio = target === 0 ? 0 : value / target;
        const over = ratio > 1;

        return (
          <div key={key}>
            <dt className="sr-only">{label}</dt>
            <dd>
              <div className="flex items-baseline gap-1 font-mono text-sm tabular-nums">
                <span className="text-ink">{formatDecimal(value)}</span>
                <span className="text-ink-subtle">
                  /{formatDecimal(target)}
                  {unit}
                </span>
              </div>

              <div
                className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted"
                role="progressbar"
                aria-label={`${label}: ${formatDecimal(value)} de ${formatDecimal(target)}${unit}`}
                aria-valuenow={value}
                aria-valuemin={0}
                aria-valuemax={target}
              >
                <div
                  // Capped at 100% so the bar never escapes its track; going
                  // over is signalled by colour instead.
                  style={{ width: `${String(Math.min(ratio, 1) * 100)}%` }}
                  className={cn(
                    "h-full rounded-full transition-[width] duration-300 ease-out",
                    over ? "bg-danger" : fill,
                  )}
                />
              </div>

              <p className="mt-1 text-[0.6875rem] text-ink-subtle">{label}</p>
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
