"use client";

import { noticeClasses } from "@/design-system/components/notice";
import { Plus, Star } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { cn } from "@/design-system/cn";
import { buttonClasses } from "@/design-system/components/button";
import { Card } from "@/design-system/components/card";
import { Input } from "@/design-system/components/input";
import { useIncrementalReveal } from "@/design-system/hooks/use-incremental-reveal";

import { useFoodCatalogue } from "../hooks/use-food-catalogue";
import { searchFoods } from "../services/search-foods";
import { FOOD_CATEGORIES, type FoodCategory } from "../types/food";
import { FoodCategoryCards } from "./food-category-cards";
import { FoodList } from "./food-list";
import { FoodListSkeleton } from "./food-list-skeleton";

export function FoodBrowser() {
  const { state, writeError, toggleFavorite, removeFood } = useFoodCatalogue();
  const [text, setText] = useState("");
  const [category, setCategory] = useState<FoodCategory | null>(null);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  // Filtering runs on every render rather than living in state. The catalogue
  // is a few hundred rows, so it costs microseconds — and derived state that
  // can fall out of sync with its inputs is a bug waiting to happen.
  const results =
    state.status === "ready"
      ? searchFoods(state.foods, { text, category, favoritesOnly })
      : [];
  // Quantos cada cartão mostraria, com a busca e a estrela como estão.
  const categoryCounts = Object.fromEntries(
    FOOD_CATEGORIES.map((option) => [
      option,
      state.status === "ready" ? searchFoods(state.foods, { text, category: option, favoritesOnly }).length : 0,
    ]),
  ) as Record<FoodCategory, number>;

  // Bounds how many rows exist in the DOM at once, so 580 catalogue foods —
  // already unpaginated on this screen, unlike the picker's old 8-result
  // cap — cannot make every keystroke re-render the whole table. See
  // `useIncrementalReveal`.
  const { count, hasMore, sentinelRef } = useIncrementalReveal(
    `${text}|${category ?? ""}|${String(favoritesOnly)}`,
    results.length,
  );
  const visible = results.slice(0, count);

  return (
    <div className="space-y-5">
      <div className="flex gap-2">
        <Input
          type="search"
          value={text}
          onChange={(event) => {
            setText(event.target.value);
          }}
          placeholder="Buscar alimento"
          aria-label="Buscar alimento"
          autoComplete="off"
          disabled={state.status !== "ready"}
        />
        {/* Favoritos direto na linha da busca (roadmap 10.5, 30/09/2026).
            Era um botão "Filtros" que abria uma folha com as categorias e a
            estrela; as categorias subiram para os cartões, e uma folha para
            um botão só não se justifica. Ativo é `primary`, como era o
            Filtros com algo marcado. */}
        <button
          type="button"
          aria-pressed={favoritesOnly}
          aria-label="Só favoritos"
          onClick={() => {
            setFavoritesOnly(!favoritesOnly);
          }}
          className={cn(
            buttonClasses(favoritesOnly ? "primary" : "secondary"),
            // Matches the field beside it: `--control-h` varies with density,
            // `--input-h` stays fixed at 44px on purpose (input.tsx).
            "h-(--input-h)",
          )}
        >
          <Star aria-hidden className="size-4" fill={favoritesOnly ? "currentColor" : "none"} />
          <span className="hidden sm:inline">Favoritos</span>
        </button>

        <Link
          href="/alimentos/novo"
          className={cn(
            // `secondary`, não o `primary` padrão de `buttonClasses()` —
            // achado de auditoria de design (02/09/2026): este botão media
            // verde ao lado do "Novo exercício" cinza do catálogo irmão, sem
            // motivo próprio para a diferença. `exercise-browser.tsx` já
            // documenta por que o botão de criar não é `primary` num
            // catálogo curado — "convidaria duplicata" — e 580 alimentos já
            // curados são o mesmo caso, só que maior.
            buttonClasses("secondary"),
            // Same row as the field beside it — see the note on the star above.
            "h-(--input-h)",
          )}
        >
          <Plus aria-hidden className="size-4" />
          <span className="hidden sm:inline">Novo</span>
          <span className="sr-only sm:hidden">Novo alimento</span>
        </Link>
      </div>

      {/* As categorias como atalho (roadmap 10.5, decisão do Pedro em
          30/09/2026). Antes ficavam numa folha atrás de "Filtros" porque,
          abertas como pílulas, custavam ~200px em toda visita; o Pedro
          escolheu os cartões no topo sabendo desse custo. */}
      {state.status === "ready" && (
        <FoodCategoryCards
          counts={categoryCounts}
          total={searchFoods(state.foods, { text, category: null, favoritesOnly }).length}
          active={category}
          onSelect={setCategory}
        />
      )}

      {writeError !== null && (
        <p role="alert" className={noticeClasses()}>
          {writeError}
        </p>
      )}

      {state.status === "loading" && <FoodListSkeleton />}

      {state.status === "error" && <ErrorState message={state.message} />}

      {state.status === "ready" && (
        <>
          {/* Announced rather than only shown, so a screen-reader user knows
              the list changed as they type. */}
          <p
            className="text-sm text-ink-subtle"
            role="status"
            aria-live="polite"
          >
            {results.length === 0
              ? "Nenhum alimento encontrado"
              : `${results.length} ${results.length === 1 ? "alimento" : "alimentos"}`}
          </p>

          {results.length === 0 ? (
            <EmptyState
              favoritesOnly={favoritesOnly}
              hasFilters={text !== "" || category !== null}
            />
          ) : (
            <FoodList
              foods={visible}
              hasMore={hasMore}
              sentinelRef={sentinelRef}
              onToggleFavorite={(food) => void toggleFavorite(food)}
              onRemove={(food) => void removeFood(food)}
            />
          )}
        </>
      )}
    </div>
  );
}

function EmptyState({
  favoritesOnly,
  hasFilters,
}: {
  readonly favoritesOnly: boolean;
  readonly hasFilters: boolean;
}) {
  const { title, hint } = emptyCopy(favoritesOnly, hasFilters);

  return (
    <Card tone="quiet" className="text-center">
      <p className="text-ink">{title}</p>
      <p className="mt-1.5 text-sm text-ink-subtle">{hint}</p>
    </Card>
  );
}

/** Each empty case names what to do next, rather than only what is missing. */
function emptyCopy(favoritesOnly: boolean, hasFilters: boolean) {
  if (favoritesOnly && !hasFilters) {
    return {
      title: "Você ainda não favoritou nenhum alimento.",
      hint: "Toque na estrela ao lado de um alimento para tê-lo sempre à mão.",
    };
  }

  if (favoritesOnly || hasFilters) {
    return {
      title: "Nenhum alimento corresponde aos filtros.",
      hint: "Tente outro termo, ou remova um dos filtros ativos.",
    };
  }

  return {
    title: "Nenhum alimento no banco.",
    hint: "Recarregue a página para preencher o banco automaticamente.",
  };
}

function ErrorState({ message }: { readonly message: string }) {
  return (
    <div role="alert" className={noticeClasses("danger", "block")}>
      <p className="text-ink">Não foi possível carregar os alimentos.</p>
      <p className="mt-1.5 text-sm text-ink-muted">{message}</p>
    </div>
  );
}
