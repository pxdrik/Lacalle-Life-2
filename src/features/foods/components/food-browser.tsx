"use client";

import { noticeClasses } from "@/design-system/components/notice";
import { Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { buttonClasses } from "@/design-system/components/button";
import { Card } from "@/design-system/components/card";
import { Input } from "@/design-system/components/input";

import { useFoodCatalogue } from "../hooks/use-food-catalogue";
import { searchFoods } from "../services/search-foods";
import type { FoodCategory } from "../types/food";
import { FoodFilters } from "./food-filters";
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
        {/* The recipe, not a copy of it. Written out by hand this button stood
            44px tall next to a 40px search field and hung four pixels below
            it — the screen's primary action, and the one control in the app
            that did not read its height from the density tokens. */}
        <Link href="/alimentos/novo" className={buttonClasses()}>
          <Plus aria-hidden className="size-4" />
          <span className="hidden sm:inline">Novo</span>
          <span className="sr-only sm:hidden">Novo alimento</span>
        </Link>
      </div>

      <FoodFilters
        category={category}
        favoritesOnly={favoritesOnly}
        onCategoryChange={setCategory}
        onFavoritesOnlyChange={setFavoritesOnly}
      />

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
              foods={results}
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
