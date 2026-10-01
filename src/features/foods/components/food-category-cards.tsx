import { GroupCards } from "@/design-system/components/group-cards";

import { FOOD_CATEGORIES, FOOD_CATEGORY_LABELS, type FoodCategory } from "../types/food";

/**
 * As categorias de alimento como atalho, no topo de Alimentos e do seletor
 * do Diário (roadmap 10.5, 30/09/2026): o mesmo papel dos grupos de
 * exercício (10.1). Três colunas, que caem para duas na tela estreita:
 * "Carboidratos" não cabe em quatro (ver `GroupCards`).
 */
export function FoodCategoryCards({
  counts,
  total,
  active,
  onSelect,
}: {
  /** Quantos alimentos cada categoria mostraria, com a busca e a estrela como estão. */
  readonly counts: Readonly<Record<FoodCategory, number>>;
  readonly total: number;
  readonly active: FoodCategory | null;
  readonly onSelect: (category: FoodCategory | null) => void;
}) {
  return (
    <GroupCards
      label="Categorias"
      columns="three"
      active={active}
      onSelect={onSelect}
      cards={[
        ...FOOD_CATEGORIES.map((category) => ({
          key: category,
          label: FOOD_CATEGORY_LABELS[category],
          count: counts[category],
        })),
        { key: null, label: "Todos", count: total },
      ]}
    />
  );
}
