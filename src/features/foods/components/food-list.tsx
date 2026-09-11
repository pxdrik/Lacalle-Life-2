import { Tabela } from "@/design-system/components/tabela";
import { MACRO_CODING } from "@/design-system/macros";

import type { Food } from "../types/food";
import { FoodRow } from "./food-row";

interface Props {
  readonly foods: readonly Food[];
  /** More rows exist below `foods` — see `useIncrementalReveal`. */
  readonly hasMore?: boolean;
  readonly sentinelRef?: React.RefCallback<Element>;
  readonly onToggleFavorite: (food: Food) => void;
  readonly onRemove: (food: Food) => void;
}

/**
 * O espaço que sobra pro `flex-1`, entre a coluna "100 g" e as quatro
 * colunas de macro, é estreito de verdade num iPhone real — uns 30-40px.
 * `MACRO_CODING` já traz o rótulo curto certo (`short`); só a largura de
 * cada coluna é propriedade da lista, porque é ela que precisa bater com a
 * largura que `FoodRow` usa pro mesmo valor.
 */
const COLUMNS = [
  { key: "kcal", label: "kcal", width: "w-11" },
  ...MACRO_CODING.map(({ key, short }) => ({
    key,
    label: short,
    width: "w-9",
  })),
];

/** A estrela de favorito (`size-8`), depois a área de editar/excluir (`w-16`) — nessa ordem, a mesma que `FoodRow` desenha. */
const TRAILING_SPACERS = ["w-8", "w-16"];

export function FoodList({
  foods,
  hasMore = false,
  sentinelRef,
  onToggleFavorite,
  onRemove,
}: Props) {
  return (
    <Tabela primaryLabel="100 g" columns={COLUMNS} trailingSpacers={TRAILING_SPACERS}>
      {foods.map((food) => (
        <FoodRow
          key={food.id}
          food={food}
          onToggleFavorite={onToggleFavorite}
          onRemove={onRemove}
        />
      ))}

      {/* Unrendered rows below this point exist in the catalogue, not in
          the DOM yet — see `useIncrementalReveal`. */}
      {hasMore && sentinelRef !== undefined && (
        <li ref={sentinelRef} aria-hidden className="h-px" />
      )}
    </Tabela>
  );
}
