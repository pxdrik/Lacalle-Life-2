"use client";

import { useState } from "react";

import { Input } from "@/design-system/components/input";

import { useFoodCatalogue } from "../hooks/use-food-catalogue";
import { searchFoods } from "../services/search-foods";
import type { FoodCategory } from "../types/food";
import { FoodCategoryFilter } from "./food-category-filter";
import { FoodList } from "./food-list";
import { FoodListSkeleton } from "./food-list-skeleton";

export function FoodBrowser() {
  const catalogue = useFoodCatalogue();
  const [text, setText] = useState("");
  const [category, setCategory] = useState<FoodCategory | null>(null);

  // Filtering runs on every render rather than in state. The catalogue is a
  // few hundred rows, so it costs microseconds — and derived state that can
  // fall out of sync with its inputs is a bug waiting to happen.
  const results =
    catalogue.status === "ready"
      ? searchFoods(catalogue.foods, { text, category })
      : [];

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <Input
          type="search"
          value={text}
          onChange={(event) => {
            setText(event.target.value);
          }}
          placeholder="Buscar alimento"
          aria-label="Buscar alimento"
          autoComplete="off"
          disabled={catalogue.status !== "ready"}
        />
        <FoodCategoryFilter value={category} onChange={setCategory} />
      </div>

      {catalogue.status === "loading" && <FoodListSkeleton />}

      {catalogue.status === "error" && <ErrorState message={catalogue.message} />}

      {catalogue.status === "ready" && (
        <>
          {/* Announced rather than shown alone, so a screen-reader user knows
              the list changed as they type. */}
          <p className="text-sm text-ink-subtle" role="status" aria-live="polite">
            {results.length === 0
              ? "Nenhum alimento encontrado"
              : `${results.length} ${results.length === 1 ? "alimento" : "alimentos"}`}
          </p>

          {results.length === 0 ? (
            <EmptyState hasFilters={text !== "" || category !== null} />
          ) : (
            <FoodList foods={results} />
          )}
        </>
      )}
    </div>
  );
}

function EmptyState({ hasFilters }: { readonly hasFilters: boolean }) {
  return (
    <div className="rounded-xl border border-dashed border-line px-6 py-14 text-center">
      <p className="text-ink">
        {hasFilters
          ? "Nenhum alimento corresponde à busca."
          : "Nenhum alimento no banco."}
      </p>
      <p className="mt-1.5 text-sm text-ink-subtle">
        {hasFilters
          ? "Tente outro termo ou remova o filtro de categoria."
          : "O banco será preenchido automaticamente na próxima vez que você abrir esta página."}
      </p>
    </div>
  );
}

function ErrorState({ message }: { readonly message: string }) {
  return (
    <div
      role="alert"
      className="rounded-xl border border-danger/30 bg-danger/5 px-6 py-8 text-center"
    >
      <p className="text-ink">Não foi possível carregar os alimentos.</p>
      <p className="mt-1.5 text-sm text-ink-muted">{message}</p>
    </div>
  );
}
