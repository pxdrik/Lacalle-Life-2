import type { Macros } from "@/core/domain/macros";
import { formatDecimal } from "@/core/format/decimal";
import { cn } from "@/design-system/cn";

const BARS = [
  { key: "kcal", label: "kcal", fill: "bg-ink", unit: "" },
  { key: "proteinG", label: "Prot", fill: "bg-protein", unit: "g" },
  { key: "carbsG", label: "Carb", fill: "bg-carbs", unit: "g" },
  { key: "fatG", label: "Gord", fill: "bg-fat", unit: "g" },
] as const;

interface Props {
  readonly totals: Macros;
  readonly targets: Macros;
  /**
   * Which figures to draw, in this order. Defaults to all four.
   *
   * The home screen passes the three macros and leaves `kcal` out, because the
   * ring beside these bars is already the calorie figure — drawing it twice
   * would make the same number look like two measurements.
   */
  readonly figures?: readonly (typeof BARS)[number]["key"][];
}

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
export function MacroProgress({ totals, targets, figures }: Props) {
  const bars =
    figures === undefined
      ? BARS
      : figures.map((key) => BARS.find((bar) => bar.key === key)!);

  return (
    // Two columns on a phone. Four of these never fit a 360px screen — a
    // column gets ~70px and "1.256/2.220" needs ~90 — so the calorie figure
    // used to run under the protein one. Four across from `sm`, where there is
    // room for a single glanceable line. Three figures get their own column
    // each, which is why the count comes from the list rather than a constant.
    <dl
      className={cn(
        "grid gap-x-5 gap-y-3 sm:gap-3",
        bars.length === 3 ? "grid-cols-3" : "grid-cols-2 sm:grid-cols-4",
      )}
    >
      {bars.map(({ key, label, fill, unit }) => {
        const value = totals[key];
        const target = targets[key];
        const ratio = target === 0 ? 0 : value / target;
        const over = ratio > 1;

        return (
          <div key={key}>
            <dt className="sr-only">{label}</dt>
            <dd>
              <div className="flex items-baseline gap-1 text-sm tabular-nums">
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

              {/* The dot carries the colour when the bar cannot.
                  Protein, carbohydrate and fat each own a hue across the whole
                  app, but the bar only shows it once something has been eaten
                  — so on a fresh morning the card was three grey tracks under
                  three grey words, and the coding that the rest of the app
                  relies on simply was not there. It marks identity, not state:
                  it keeps its hue when the bar turns red for going over. */}
              <p className="mt-1 flex items-center gap-1.5 text-[0.6875rem] text-ink-subtle">
                <span
                  aria-hidden
                  className={cn("size-1.5 shrink-0 rounded-full", fill)}
                />
                {label}
              </p>
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
