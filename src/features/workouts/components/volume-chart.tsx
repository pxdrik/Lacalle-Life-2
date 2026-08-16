import { Card } from "@/design-system/components/card";

import type { VolumePoint } from "../services/history";
import { formatDecimal } from "@/core/format/decimal";

interface Props {
  /** Most recent first, as the service returns them. */
  readonly points: readonly VolumePoint[];
  readonly format: (point: VolumePoint) => string;
}

/**
 * Volume per period, as plain divs.
 *
 * No charting library. This is a bar per period with a label under it — a
 * hundred kilobytes of Recharts to draw eight rectangles would be the single
 * largest dependency in the app, and it would arrive on a page that renders
 * fine without it.
 *
 * The bars read as a table to a screen reader, which is more useful than any
 * canvas: `role="img"` on a chart says "chart" and stops there.
 */
export function VolumeChart({ points, format }: Props) {
  const chronological = [...points].reverse();
  const peak = Math.max(...chronological.map((point) => point.volumeKg), 1);

  return (
    <Card>
      {/* Linha de base em Gray 200, que a pág. 29 pede junto com o resto da
          moldura do gráfico. Sem ela as barras flutuam: a leitura de altura
          precisa de um zero visível para ser uma leitura. */}
      <ul className="flex h-40 items-end gap-1.5 border-b border-line">
        {chronological.map((point) => {
          const height = (point.volumeKg / peak) * 100;

          return (
            <li
              key={point.startsAt}
              className="flex h-full flex-1 flex-col justify-end"
            >
              <span className="sr-only">
                {format(point)}: {formatDecimal(point.volumeKg)} kg em{" "}
                {point.sets} séries
              </span>

              {/* Uma cor de acento no gráfico inteiro, e cinza onde não houve
                  dado — pág. 29. O período sem treino fica em Gray 300, que é
                  a cor que a mesma página reserva ao que não é o dado
                  principal. */}
              <span
                aria-hidden
                title={`${formatDecimal(point.volumeKg)} kg · ${String(point.sets)} séries`}
                className={
                  point.volumeKg === 0
                    ? "min-h-0.5 rounded-t-full bg-line-strong"
                    : "min-h-1 rounded-t-full bg-accent transition-[height] duration-(--duration-standard) ease-out"
                }
                style={{ height: `${String(Math.max(height, 1))}%` }}
              />
            </li>
          );
        })}
      </ul>

      {/* 12 px, não 10. A pág. 48 fixa 12 como piso de texto e a pág. 32 lista
          "reduzir a fonte abaixo de 12 px para caber" entre os não fazer — que
          era exatamente o motivo do 10. O rótulo trunca quando não cabe, e o
          valor inteiro continua no texto de leitor de tela acima. */}
      <ul aria-hidden className="mt-2 flex gap-1.5">
        {chronological.map((point) => (
          <li
            key={point.startsAt}
            className="flex-1 truncate text-center text-xs tabular-nums text-ink-subtle"
          >
            {format(point)}
          </li>
        ))}
      </ul>
    </Card>
  );
}
