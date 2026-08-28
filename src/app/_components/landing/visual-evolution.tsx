import { cardSurface } from "@/design-system/components/card";

const BARS = [30, 45, 38, 52, 60, 55, 72] as const;

/**
 * O gráfico de volume semanal em miniatura, mesma barra de acento sobre o
 * mesmo fundo que `/evolucao` desenha de verdade, sem nenhum eixo com número
 * inventado que pareça um dado real.
 */
export function VisualEvolution() {
  return (
    <div className={cardSurface("hero")}>
      <p className="text-xs text-ink-subtle">Volume semanal</p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-ink">
        1.240 kg <span className="text-sm font-normal text-ink-subtle">últimas 4 semanas</span>
      </p>

      <div className="mt-5 flex h-24 items-end gap-2">
        {BARS.map((value, index) => (
          <div
            key={index}
            aria-hidden
            className="flex-1 rounded-sm bg-accent/15"
            style={{ height: `${String(value)}%` }}
          >
            <div
              className="h-full w-full rounded-sm bg-accent"
              style={{
                opacity: index === BARS.length - 1 ? 1 : 0,
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
