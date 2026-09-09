"use client";

import { useState } from "react";

import { cn } from "@/design-system/cn";

/**
 * A number and what it means, in the register the number deserves.
 *
 * Pulled out of the shape `plan-summary.tsx` and `macro-summary.tsx` already
 * repeated by hand — value, unit, label, three sizes of the same idea — so a
 * fourth screen reaching for "big number, small caption" has one place to
 * reach for it instead of a fourth hand-rolled copy.
 *
 * Deliberately just the two lines. A `Metric` that also drew a ring or a bar
 * would be reaching into `CalorieRing` and `MacroProgress`'s job — this stays
 * the typographic half only, so those two keep owning their own graphic.
 */
type MetricSize = "sm" | "md" | "lg";

const VALUE: Record<MetricSize, string> = {
  sm: "text-sm font-semibold",
  md: "text-xl font-semibold",
  lg: "text-3xl font-semibold sm:text-4xl",
};

const LABEL: Record<MetricSize, string> = {
  sm: "text-[0.6875rem]",
  md: "text-xs",
  lg: "text-sm",
};

interface Props {
  readonly value: string;
  readonly unit?: string;
  readonly label: string;
  readonly size?: MetricSize;
  /**
   * Ties the value to a semantic tone — e.g. `text-warning` when a total
   * reads past its target. Applied to the value only; the label always stays
   * `--ink-subtle`, because the label names the figure and never inherits its
   * state.
   */
  readonly tone?: string;
  /** `center` for a metric sitting alone in a grid cell — e.g. the macro strip under a ring. */
  readonly align?: "start" | "center";
  readonly className?: string;
}

export function Metric({
  value,
  unit,
  label,
  size = "md",
  tone,
  align = "start",
  className,
}: Props) {
  const centered = align === "center";

  // "Number Update" — Motion System v1, emenda de 09/09/2026
  // (docs/brandbook.md): o valor pisca no acento e sobe um instante quando
  // muda, então confirma e volta ao tom de sempre. Comparado contra o texto
  // já formatado, não o número cru — trocar de 71,96 para 72,04 não deve
  // piscar se as duas arredondam para "72". Ajustado durante a própria
  // renderização (mesma técnica de `GramsField`), não um efeito: todo
  // `Metric` da tela já entra com o valor certo, o "visto" começa igual ao
  // que chegou.
  const [seen, setSeen] = useState(value);
  const [changes, setChanges] = useState(0);
  if (value !== seen) {
    setSeen(value);
    setChanges((count) => count + 1);
  }

  return (
    <div className={cn(centered && "text-center", className)}>
      <div
        className={cn(
          "flex items-baseline gap-1 tabular-nums",
          centered && "justify-center",
        )}
      >
        <span
          key={changes}
          className={cn(
            VALUE[size],
            tone ?? "text-ink",
            changes > 0 && "animate-value-change motion-reduce:animate-none",
          )}
        >
          {value}
        </span>
        {unit !== undefined && (
          <span className={cn(LABEL[size], "text-ink-subtle")}>{unit}</span>
        )}
      </div>
      <p className={cn(LABEL[size], "mt-0.5 text-ink-subtle")}>{label}</p>
    </div>
  );
}
