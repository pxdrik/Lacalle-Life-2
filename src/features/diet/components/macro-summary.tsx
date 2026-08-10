import type { Macros } from "@/core/domain/macros";
import { formatDecimal } from "@/core/format/decimal";
import { cn } from "@/design-system/cn";

interface Props {
  readonly macros: Macros;
  readonly size?: "sm" | "lg";
}

const MACROS = [
  { key: "proteinG", label: "Prot", color: "text-protein" },
  { key: "carbsG", label: "Carb", color: "text-carbs" },
  { key: "fatG", label: "Gord", color: "text-fat" },
] as const;

/**
 * Calories, then the three macros.
 *
 * Calories lead and carry no colour: they are the number people check first,
 * and the macros beside them are what the colours distinguish.
 */
export function MacroSummary({ macros, size = "sm" }: Props) {
  const large = size === "lg";

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
        <dd className={cn("text-ink", large ? "text-xl font-medium" : "text-sm")}>
          {formatDecimal(macros.kcal)}
        </dd>
        <dt className={cn("text-ink-subtle", large ? "text-xs" : "text-[0.6875rem]")}>
          kcal
        </dt>
      </div>

      {MACROS.map(({ key, label, color }) => (
        <div key={key} className="flex items-baseline gap-1">
          <dd className={cn(color, large ? "text-xl font-medium" : "text-sm")}>
            {formatDecimal(macros[key])}
          </dd>
          <dt
            className={cn(
              "text-ink-subtle",
              large ? "text-xs" : "text-[0.6875rem]",
            )}
          >
            {label}
          </dt>
        </div>
      ))}
    </dl>
  );
}
