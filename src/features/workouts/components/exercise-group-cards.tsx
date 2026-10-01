import { GroupCards } from "@/design-system/components/group-cards";

import { REGION_LABELS, type Region } from "../taxonomy/muscles";

/** A ordem do protótipo aprovado: o tronco, os membros, e por fim cardio. */
const ORDER: readonly Region[] = ["peito", "costas", "ombros", "bracos", "core", "pernas", "cardio"];

/**
 * Os grupos do catálogo de exercícios como atalho, no topo de Exercícios
 * (roadmap 10.1, 30/09/2026): 4 + 4 com "Todos". A grade e o porquê dos
 * cartões estão em `GroupCards`.
 */
export function ExerciseGroupCards({
  counts,
  total,
  active,
  onSelect,
}: {
  /** Quantos exercícios cada grupo mostraria, com os outros filtros como estão. */
  readonly counts: Readonly<Record<Region, number>>;
  /** Quantos sem grupo ("Todos"). */
  readonly total: number;
  readonly active: Region | null;
  readonly onSelect: (region: Region | null) => void;
}) {
  return (
    <GroupCards
      label="Grupos musculares"
      columns="four"
      active={active}
      onSelect={onSelect}
      cards={[
        ...ORDER.map((region) => ({ key: region, label: REGION_LABELS[region], count: counts[region] })),
        { key: null, label: "Todos", count: total },
      ]}
    />
  );
}
