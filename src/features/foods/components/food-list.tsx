import { Card } from "@/design-system/components/card";

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
 * The column header carries the units once so the rows do not repeat them.
 * Hidden from screen readers because it labels a list, not a table — each row
 * already reads out as a sentence.
 */
function ColumnHeader() {
  return (
    <div
      aria-hidden
      className="flex items-center gap-3 border-b border-line px-3 pb-2 text-[0.6875rem] font-medium tracking-wide text-ink-subtle uppercase"
    >
      <span className="w-8 shrink-0" />
      {/* O espaço que sobra pro `flex-1`, entre os espaçadores fixos e as
          quatro colunas de macro, é estreito de verdade num iPhone real —
          uns 30-40px. "Por 100 g" nesse espaço quebrava em três linhas
          (POR / 100 / G) enquanto kcal/Prot/Carb/Gord ficavam numa só,
          torcendo a linha inteira do cabeçalho — print do Pedro,
          26/08/2026. "100 g" é curto o bastante pra caber numa linha só
          nesse espaço; `truncate` é a rede de segurança para uma tela
          ainda mais estreita, não a correção em si. */}
      <span className="flex-1 truncate">100 g</span>
      <span className="flex shrink-0 gap-3 sm:gap-4">
        <span className="w-11 text-right">kcal</span>
        <span className="w-9 text-right">Prot</span>
        <span className="w-9 text-right">Carb</span>
        <span className="w-9 text-right">Gord</span>
      </span>
      {/* w-16, não w-8: tem que bater com o espaço reservado em `FoodRow`
          para editar/excluir (§achado 25/08/2026) — só um alimento
          personalizado usa esse espaço, mas toda linha o reserva, e um
          cabeçalho mais estreito desalinhava as colunas de macros em 32px
          de todas as linhas, sempre, não só nas personalizadas. */}
      <span className="w-16 shrink-0" />
    </div>
  );
}

export function FoodList({
  foods,
  hasMore = false,
  sentinelRef,
  onToggleFavorite,
  onRemove,
}: Props) {
  return (
    <Card padded={false} className="overflow-hidden">
      <div className="pt-3">
        <ColumnHeader />
      </div>

      <ul className="divide-y divide-line">
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
      </ul>
    </Card>
  );
}
