import type { Macros } from "@/core/domain/macros";
import { formatDecimal } from "@/core/format/decimal";
import { cn } from "@/design-system/cn";
import { MACRO_CODING } from "@/design-system/macros";

/**
 * Calories lead, then the three macros in the app's coding.
 *
 * The calorie bar is written here rather than taken from `MACRO_CODING`
 * because it is not one of them: it is drawn in ink, it is the only figure
 * without a unit, and it is the one the home screen leaves out because the
 * ring beside these bars already is it.
 */
const BARS = [
  { key: "kcal", label: "kcal", long: "kcal", fill: "bg-ink", unit: "" },
  ...MACRO_CODING.map(({ key, short, long, fill }) => ({
    key,
    label: short,
    long,
    fill,
    unit: "g",
  })),
] as const;

/**
 * How the figures are arranged, not what they say.
 *
 * `grid` is the dense line the diary and the diet editor need, where these
 * bars sit under a total and must not take a screen of their own.
 *
 * `rows` is one figure per line, with room for the long name — **and only from
 * `lg`, which is where it earns its height.** It exists so the macro block can
 * stand beside the calorie ring without the grid stretching the difference
 * into dead space, and the two are only side by side on a wide screen. Applied
 * on a phone, where the blocks stack and there is nothing to balance, the same
 * arrangement measured 272px against 130 and pushed the weight block 140px
 * further down a screen the app is meant to be read on one-handed.
 *
 * A prop rather than a second component: the numbers, the cap, the amber and
 * the announcement are the parts that must never diverge between screens, and
 * a copy is how they would.
 */
type MacroLayout = "grid" | "rows";

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
  readonly layout?: MacroLayout;
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
export function MacroProgress({
  totals,
  targets,
  figures,
  layout = "grid",
}: Props) {
  const bars =
    figures === undefined
      ? BARS
      : figures.map((key) => BARS.find((bar) => bar.key === key)!);

  const rows = layout === "rows";

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
        rows && "lg:grid-cols-1 lg:gap-y-5",
      )}
    >
      {bars.map(({ key, label, long, fill, unit }) => {
        const value = totals[key];
        const target = targets[key];
        const ratio = target === 0 ? 0 : value / target;
        const over = ratio > 1;

        return (
          <div key={key}>
            {/* From `lg` in `rows` the name leads the line and carries the
                dot, which is the same coding the grid puts underneath —
                moved, not invented. Below that it goes back to `sr-only` and
                the dot returns to the foot of the column, so the two
                arrangements are the same three parts in a different order.
                The long name only appears where there is room to read it. */}
            <dt
              className={cn(
                "sr-only",
                rows &&
                  "lg:not-sr-only lg:flex lg:items-center lg:gap-1.5 lg:text-xs lg:text-ink-muted",
              )}
            >
              {rows && (
                <span
                  aria-hidden
                  className={cn(
                    "hidden size-1.5 shrink-0 rounded-full lg:block",
                    fill,
                  )}
                />
              )}
              {rows ? (
                <>
                  <span className="hidden lg:inline">{long}</span>
                  <span className="lg:hidden">{label}</span>
                </>
              ) : (
                label
              )}
            </dt>
            <dd className={cn(rows && "lg:mt-1")}>
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
                  //
                  // Amber, not red. Red is what this app uses for something
                  // being wrong — a save that failed, a catalogue that would
                  // not load — and eating 30 g of carbohydrate past a target
                  // is not that. It is worth noticing and it is not a fault,
                  // which is the whole distinction a warning tone exists to
                  // draw. Colouring it red made a normal Tuesday look like a
                  // malfunction.
                  // `min-width` of one track height: the fill is already
                  // `rounded-full`, but below its own height the round cap has
                  // no room and the bar ends in a hard edge — the one shape
                  // the brand does not make. Only when there is something to
                  // show; zero stays zero.
                  style={{
                    width: `${String(Math.min(ratio, 1) * 100)}%`,
                    minWidth: value > 0 ? "0.25rem" : undefined,
                  }}
                  className={cn(
                    "h-full rounded-full transition-[width] duration-(--duration-standard) ease-out",
                    over ? "bg-warning" : fill,
                  )}
                />
              </div>

              {/* The dot carries the colour when the bar cannot.
                  Protein, carbohydrate and fat each own a hue across the whole
                  app, but the bar only shows it once something has been eaten
                  — so on a fresh morning the card was three grey tracks under
                  three grey words, and the coding that the rest of the app
                  relies on simply was not there. It marks identity, not state:
                  it keeps its hue when the bar turns red for going over.

                  From `lg` in `rows` the same dot is already up on the name,
                  so drawing it again here would state the code twice on one
                  line. */}
              <p
                className={cn(
                  "mt-1 flex items-center gap-1.5 text-[0.6875rem] text-ink-subtle",
                  rows && "lg:hidden",
                )}
              >
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
