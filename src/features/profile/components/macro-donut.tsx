import { formatDecimal } from "@/core/format/decimal";
import { cn } from "@/design-system/cn";
import { MACRO_CODING, type MacroKey } from "@/design-system/macros";

/** Espaço em volta do anel para os percentuais: cabe "100%" em 11px. */
const LABEL_PAD = 26;

/**
 * Onde o percentual fica, do lado de fora do anel. À direita o texto começa
 * junto do anel, à esquerda termina junto dele, em cima e embaixo fica
 * centrado. A distância cresce com o seno do ângulo: quanto mais para cima ou
 * para baixo, mais da meia altura do texto (~6 em 11px) aponta para o centro,
 * e sem essa folga o canto do texto encostava no traço nas diagonais.
 */
function labelPlacement(
  center: number,
  labelRadius: number,
  angle: number,
): { x: number; y: number; textAnchor: "start" | "middle" | "end" } {
  const cos = Math.cos(angle);
  const textAnchor = cos > 0.35 ? "start" : cos < -0.35 ? "end" : "middle";
  const distance = labelRadius + 6 * Math.abs(Math.sin(angle));
  return {
    x: center + distance * cos,
    y: center + distance * Math.sin(angle),
    textAnchor,
  };
}

const STROKE_CLASS: Record<MacroKey, string> = {
  proteinG: "stroke-protein",
  carbsG: "stroke-carbs",
  fatG: "stroke-fat",
};

/**
 * The macro split, drawn — Pedro, 24/09/2026, after seeing the reference
 * app's "Goals" screen: "a distribuição vamos fazer o gráfico, igual mandei
 * em imagem. Vai ficar mais fácil do usuário enxergar." Reused smaller
 * (25/09/2026, "deixe ele menor") both on `PlanSummary` and, per Pedro's
 * follow-up the same day, as a per-row preview inside `MacroSplitDialog` —
 * `size` and `showLabels` exist for that second, much smaller context.
 *
 * Takes weights, not grams or a `Macros` — a preset's percentages and a
 * plan's kcal-per-macro are both "three non-negative numbers that describe a
 * split", and normalising them is the same one division either way. The
 * caller decides what a share *is* (kcal, a raw percent); this only draws
 * the proportion.
 *
 * `aria-hidden`: wherever this is used, the real numbers are already on
 * screen in text, in the same three colours (`MACRO_CODING`) — this is the
 * visual reinforcement, not a second source of it.
 */
export function MacroDonut({
  shares,
  size = 80,
  showLabels = true,
  className,
}: {
  readonly shares: Record<MacroKey, number>;
  readonly size?: number;
  readonly showLabels?: boolean;
  readonly className?: string;
}) {
  // Roadmap 8.8 (29/09/2026): os percentuais ficam **fora** do anel, numa
  // margem em volta dele. Em cima do anel, "25%" era mais largo que a
  // espessura do traço (~10px em 64px), e duas fatias pequenas vizinhas
  // punham os rótulos um em cima do outro. `size` continua sendo o anel.
  const pad = showLabels ? LABEL_PAD : 0;
  const box = size + pad * 2;
  const center = box / 2;
  const stroke = Math.max(4, Math.round(size * 0.16));
  const radius = size / 2 - stroke / 2 - 2;
  const labelRadius = radius + stroke / 2 + 4;
  const circumference = 2 * Math.PI * radius;

  const total = MACRO_CODING.reduce((sum, macro) => sum + shares[macro.key], 0);

  // Two passes rather than a running total mutated across iterations: each
  // slice's length depends only on its own share, and its start is the sum
  // of every share before it — a pure lookup, not state carried forward.
  const slices = MACRO_CODING.map((macro) => {
    const fraction = total > 0 ? shares[macro.key] / total : 0;
    return { macro, fraction, length: fraction * circumference };
  });

  const arcs = slices.map((slice, index) => {
    const start = slices
      .slice(0, index)
      .reduce((sum, prior) => sum + prior.length, 0);
    const midAngleRad =
      ((start + slice.length / 2) / circumference) * 2 * Math.PI -
      Math.PI / 2;

    return { ...slice, start, midAngleRad };
  });

  return (
    <svg
      aria-hidden
      width={box}
      height={box}
      viewBox={`0 0 ${String(box)} ${String(box)}`}
      className={cn("shrink-0", className)}
    >
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        strokeWidth={stroke}
        className="stroke-muted"
      />
      {arcs.map(
        ({ macro, length, start, fraction }) =>
          fraction > 0 && (
            <circle
              key={macro.key}
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              strokeWidth={stroke}
              strokeDasharray={`${length} ${circumference - length}`}
              strokeDashoffset={-start}
              transform={`rotate(-90 ${center} ${center})`}
              className={STROKE_CLASS[macro.key]}
            />
          ),
      )}
      {showLabels &&
        arcs.map(
          ({ macro, fraction, midAngleRad }) =>
            // A slice too thin to hold its own number would just print
            // digits on top of the next slice — skipped rather than crowded.
            fraction >= 0.08 && (
              <text
                key={macro.key}
                {...labelPlacement(center, labelRadius, midAngleRad)}
                dominantBaseline="central"
                className="fill-ink text-[11px] font-semibold tabular-nums"
              >
                {formatDecimal(Math.round(fraction * 100))}%
              </text>
            ),
        )}
    </svg>
  );
}
