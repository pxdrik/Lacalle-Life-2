"use client";

import { useState } from "react";

import { Card } from "@/design-system/components/card";
import { cn } from "@/design-system/cn";

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
 *
 * ---
 *
 * **BUG-016 (auditoria externa, 14/08): o valor de cada barra só existia em
 * `title` e em texto `sr-only`.** `title` é um tooltip nativo — não abre no
 * celular, que é onde este gráfico é lido primeiro (pág. 32: "a experiência
 * mobile foi validada primeiro"). `sr-only` existe só para quem usa leitor de
 * tela, o que deixava alguém enxergando a barra, sem mouse, sem meio nenhum de
 * descobrir o número que ela representa.
 *
 * A saída não é imprimir um número por barra — em 12 períodos numa tela de
 * 360px isso é exatamente "uma tela cheia de números", que é o resultado que
 * se quer evitar. É uma **linha de resumo única**, sempre visível, mostrando
 * o período mais recente por padrão e trocando quando qualquer barra é tocada
 * ou focada. Cada barra virou um `<button>` de verdade — alvo grande o
 * bastante por si só (a coluna inteira da barra, não só o traço desenhado),
 * então não precisa do `touch-44` que os controles pequenos do app usam.
 */
export function VolumeChart({ points, format }: Props) {
  const chronological = [...points].reverse();
  const peak = Math.max(...chronological.map((point) => point.volumeKg), 1);

  // `null` até alguém tocar numa barra, o que mantém o resumo seguindo o
  // período mais recente mesmo que `points` seja recarregado — um índice fixo
  // ficaria apontando para o período errado se a lista mudasse de tamanho.
  const [selected, setSelected] = useState<number | null>(null);
  const activeIndex =
    selected === null
      ? chronological.length - 1
      : Math.min(selected, chronological.length - 1);
  const active = chronological[activeIndex];

  return (
    <Card>
      {active !== undefined && (
        <p className="mb-3 text-sm">
          <span className="font-medium tabular-nums text-ink">
            {formatDecimal(active.volumeKg)} kg
          </span>{" "}
          <span className="text-ink-subtle">
            · {active.sets} {active.sets === 1 ? "série" : "séries"} ·{" "}
            {format(active)}
          </span>
        </p>
      )}

      {/* Linha de base em Gray 200, que a pág. 29 pede junto com o resto da
          moldura do gráfico. Sem ela as barras flutuam: a leitura de altura
          precisa de um zero visível para ser uma leitura. */}
      <ul className="flex h-40 items-end gap-1.5 border-b border-line">
        {chronological.map((point, index) => (
          <li
            key={point.startsAt}
            className="flex h-full flex-1 flex-col justify-end"
          >
            <button
              type="button"
              onClick={() => {
                setSelected(index);
              }}
              aria-pressed={index === activeIndex}
              aria-label={`${format(point)}: ${formatDecimal(point.volumeKg)} kg em ${String(point.sets)} ${point.sets === 1 ? "série" : "séries"}`}
              title={`${formatDecimal(point.volumeKg)} kg · ${String(point.sets)} séries`}
              // A coluna inteira, não só o traço visível: um período quase sem
              // volume desenha `min-h-1` (4px), e o alvo de toque não pode
              // ficar do tamanho do desenho — é o mesmo erro do BUG-006, numa
              // superfície nova.
              className="flex h-full w-full flex-col justify-end rounded-sm transition-colors duration-(--duration-micro) ease-out hover:bg-muted focus-visible:bg-muted"
            >
              {/* Uma cor de acento no gráfico inteiro, e cinza onde não houve
                  dado — pág. 29. O período sem treino fica em Gray 300, que é
                  a cor que a mesma página reserva ao que não é o dado
                  principal. */}
              <span
                aria-hidden
                className={
                  point.volumeKg === 0
                    ? "min-h-0.5 rounded-t-full bg-line-strong"
                    : "min-h-1 rounded-t-full bg-accent transition-[height] duration-(--duration-standard) ease-out"
                }
                style={{
                  height: `${String(Math.max((point.volumeKg / peak) * 100, 1))}%`,
                }}
              />
            </button>
          </li>
        ))}
      </ul>

      {/* 12 px, não 10. A pág. 48 fixa 12 como piso de texto e a pág. 32 lista
          "reduzir a fonte abaixo de 12 px para caber" entre os não fazer — que
          era exatamente o motivo do 10. O rótulo trunca quando não cabe, e o
          valor inteiro está na linha de resumo acima e no nome acessível do
          botão. O período ativo fica em `ink`, os outros em `ink-subtle` — é
          o que liga a linha de resumo à barra que ela descreve. */}
      <ul aria-hidden className="mt-2 flex gap-1.5">
        {chronological.map((point, index) => (
          <li
            key={point.startsAt}
            className={cn(
              "flex-1 truncate text-center text-xs tabular-nums",
              index === activeIndex ? "font-medium text-ink" : "text-ink-subtle",
            )}
          >
            {format(point)}
          </li>
        ))}
      </ul>
    </Card>
  );
}
