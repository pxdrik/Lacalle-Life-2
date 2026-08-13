"use client";

import { noticeClasses } from "@/design-system/components/notice";
import { Plus, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { cn } from "@/design-system/cn";
import { Button, buttonClasses } from "@/design-system/components/button";
import { Dialog } from "@/design-system/components/dialog";
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
  const [showFilters, setShowFilters] = useState(false);

  // What the button has to report while the sheet is closed.
  const activeFilterCount = (category === null ? 0 : 1) + (favoritesOnly ? 1 : 0);

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
        {/* Collapsed behind a control, as `/exercicios` already does. Left
            open, the chips wrapped to three rows and cost ~200px on every
            visit — measured — pushing the table to 444px on a phone. Filtering
            is the secondary action here; searching 216 foods is the primary
            one, so the field stays and the chips fold away.

            The count rides on the button so a filter left on from last time is
            visible without opening anything. */}
        <button
          type="button"
          onClick={() => {
            setShowFilters(true);
          }}
          aria-label="Filtros"
          aria-haspopup="dialog"
          aria-expanded={showFilters}
          className={cn(
            buttonClasses("secondary"),
            activeFilterCount > 0 && "border-accent text-ink",
          )}
        >
          <SlidersHorizontal aria-hidden className="size-4" />
          <span className="hidden sm:inline">Filtros</span>
          {activeFilterCount > 0 && (
            <span className="tabular-nums">{activeFilterCount}</span>
          )}
        </button>

        <Link href="/alimentos/novo" className={buttonClasses()}>
          <Plus aria-hidden className="size-4" />
          <span className="hidden sm:inline">Novo</span>
          <span className="sr-only sm:hidden">Novo alimento</span>
        </Link>
      </div>

      {/* A sheet rather than a panel that grows in place: expanding inline is
          the 200px this change exists to remove. The live count is the payoff,
          so it sits at the bottom and moves as chips are chosen. */}
      <Dialog
        open={showFilters}
        title="Filtros"
        onClose={() => {
          setShowFilters(false);
        }}
        className="max-sm:inset-x-0 max-sm:top-auto max-sm:bottom-0 max-sm:m-0 max-sm:w-full max-sm:max-w-none max-sm:rounded-b-none"
      >
        <FoodFilters
          category={category}
          favoritesOnly={favoritesOnly}
          onCategoryChange={setCategory}
          onFavoritesOnlyChange={setFavoritesOnly}
        />

        <div className="sticky -bottom-5 -mx-5 -mb-5 mt-5 flex items-center justify-between gap-3 border-t border-line bg-surface px-5 py-4">
          <p aria-live="polite" className="text-sm text-ink-muted">
            <span className="tabular-nums text-ink">{results.length}</span>{" "}
            {results.length === 1 ? "alimento" : "alimentos"}
          </p>

          <Button
            size="sm"
            onClick={() => {
              setShowFilters(false);
            }}
          >
            Ver resultados
          </Button>
        </div>
      </Dialog>

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
