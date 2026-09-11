"use client";

import { ArrowDown, ArrowUp, Minus } from "lucide-react";

import { cn } from "@/design-system/cn";

/**
 * A number, the direction it moved, and whether that direction is good news.
 *
 * Extracted from the `Direction` helper `today-progress.tsx` already had
 * private to itself — the same icon + `sr-only` pattern, promoted here so a
 * second screen reaching for "cor + ícone + texto" on a delta has one place
 * to reach for it instead of a second hand-rolled copy (brandbook, seção 39:
 * "componente de comparação temporal" was proposed twice, in both products,
 * and built in neither).
 *
 * **`tone` is never inferred from the sign.** Whether "up" is good depends on
 * what's being measured: +R$ 420 de saldo is `positive`, +2kg de peso is
 * `neutral` — the same magnitude, no universal answer. The direction (arrow)
 * is always drawn, because it is a fact; the color is opt-in, because it is
 * a judgement only the caller's domain knows how to make. Defaults to
 * `neutral` so a call site that forgets to decide gets silence, not a wrong
 * verdict.
 */
type ComparisonTone = "neutral" | "positive" | "negative";

const TONE_CLASS: Record<ComparisonTone, string> = {
  neutral: "text-ink-subtle",
  positive: "text-success",
  negative: "text-danger",
};

interface Props {
  /** Signed change. Positive draws the up arrow, negative the down arrow, zero draws a dash. */
  readonly delta: number;
  /** Formats the absolute value — the sign is drawn separately, never baked in. */
  readonly formatMagnitude: (magnitude: number) => string;
  /** What the number is being compared against, e.g. "nos últimos 30 dias" or "vs. ontem". */
  readonly label: string;
  /** Caption for the zero case — "sem mudança" and "estável" both read naturally depending on the metric. */
  readonly whenZero?: string;
  readonly tone?: ComparisonTone;
  readonly className?: string;
}

export function Comparison({
  delta,
  formatMagnitude,
  label,
  whenZero = "sem mudança",
  tone = "neutral",
  className,
}: Props) {
  const toneClass = TONE_CLASS[tone];

  if (delta === 0) {
    return (
      <span className={cn("flex items-center gap-1 text-xs", toneClass, className)}>
        <Minus aria-hidden className="size-3.5 shrink-0" />
        <span className="sr-only">estável:</span>
        {whenZero} {label}
      </span>
    );
  }

  const Icon = delta > 0 ? ArrowUp : ArrowDown;
  const sign = delta > 0 ? "+" : "−";

  return (
    <span className={cn("flex items-center gap-1 text-xs", toneClass, className)}>
      <Icon aria-hidden className="size-3.5 shrink-0" />
      <span className="sr-only">{delta > 0 ? "subiu" : "desceu"}:</span>
      {sign}
      {formatMagnitude(Math.abs(delta))} {label}
    </span>
  );
}
