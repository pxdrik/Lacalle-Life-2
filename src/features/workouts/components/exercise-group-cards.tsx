"use client";

import { formatDecimal } from "@/core/format/decimal";
import { cn } from "@/design-system/cn";

import { REGION_LABELS, type Region } from "../taxonomy/muscles";

/** A ordem do protótipo aprovado: o tronco, os membros, e por fim cardio. */
const ORDER: readonly Region[] = ["peito", "costas", "ombros", "bracos", "core", "pernas", "cardio"];

interface Props {
  /** Quantos exercícios cada grupo mostraria, com os outros filtros como estão. */
  readonly counts: Readonly<Record<Region, number>>;
  /** Quantos sem grupo ("Todos"). */
  readonly total: number;
  readonly active: Region | null;
  readonly onSelect: (region: Region | null) => void;
}

/**
 * Os grupos do catálogo como atalho, no topo de Exercícios (roadmap 10.1,
 * 30/09/2026). Cartões, não pílulas, por decisão do Pedro: nome em cima do
 * número cabe numa coluna estreita (a Confortável em 320px deixa ~47px por
 * coluna), o alvo é mais alto, e o formato separa "ir para um grupo" das
 * pílulas da folha de Filtros, que filtram. "Todos" fecha a grade de 8 e
 * volta à lista inteira.
 */
export function ExerciseGroupCards({ counts, total, active, onSelect }: Props) {
  const cards: readonly { readonly region: Region | null; readonly label: string; readonly count: number }[] = [
    ...ORDER.map((region) => ({ region, label: REGION_LABELS[region], count: counts[region] })),
    { region: null, label: "Todos", count: total },
  ];

  return (
    <div role="group" aria-label="Grupos musculares" className="grid grid-cols-4 gap-1.5">
      {cards.map(({ region, label, count }) => {
        const selected = region === active;
        return (
          <button
            key={label}
            type="button"
            aria-pressed={selected}
            onClick={() => {
              onSelect(region);
            }}
            className={cn(
              // `@container`: o cartão mede a si mesmo. Estreito (a Confortável em
              // 320px deixa ~47px por coluna), o nome desce para 12px e cabe
              // inteiro; com espaço, fica nos 14px. Sem respiro lateral: com ele,
              // "Ombros" tinha folga zero e ganhava reticências. Medido no teste.
              "@container flex min-h-15 min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg border px-0 py-2 text-center",
              "transition-colors duration-150 ease-out",
              selected
                ? "border-accent bg-accent-surface text-accent-text"
                : "border-line bg-surface text-ink hover:border-line-strong",
            )}
          >
            <span className="max-w-full truncate text-xs font-medium @min-[4.5rem]:text-sm">{label}</span>
            <span className={cn("text-xs tabular-nums", selected ? "text-accent-text" : "text-ink-subtle")}>
              {formatDecimal(count)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
