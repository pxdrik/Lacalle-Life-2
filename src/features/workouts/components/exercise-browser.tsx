"use client";

import { SlidersHorizontal } from "lucide-react";
import { useState } from "react";

import { cn } from "@/design-system/cn";
import { Input } from "@/design-system/components/input";

import { useExerciseCatalogue } from "../hooks/use-exercise-catalogue";
import { useExerciseQuery } from "../hooks/use-exercise-query";
import { filterExercises } from "../services/filter-exercises";
import { searchExercises } from "../services/search-exercises";
import type { Exercise } from "../types/exercise";
import { ExerciseFilterBar } from "./exercise-filter-bar";
import { ExerciseRow } from "./exercise-row";

interface Props {
  /**
   * Present in selection mode: every row gains an add button and reports the
   * exercise back. Absent while browsing.
   *
   * This is the seam that lets the workout builder mount the same screen
   * instead of growing a second, divergent exercise list.
   */
  readonly onSelect?: (exercise: Exercise) => void;
}

export function ExerciseBrowser({ onSelect }: Props) {
  const { state, writeError, toggleFavorite } = useExerciseCatalogue();
  const { query, activeFilterCount, setText, setFilters, clear } =
    useExerciseQuery();
  const [showFilters, setShowFilters] = useState(false);

  // Search then filter, both on every render. The catalogue is a few hundred
  // rows over a prepared index, so this costs microseconds — and derived state
  // that can fall out of sync with its inputs is a bug waiting to happen.
  const results =
    state.status === "ready"
      ? filterExercises(
          searchExercises(state.index, query.text),
          query.filters,
        )
      : [];

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          type="search"
          value={query.text}
          onChange={(event) => {
            setText(event.target.value);
          }}
          placeholder="Buscar exercício"
          aria-label="Buscar exercício"
          autoComplete="off"
          disabled={state.status !== "ready"}
        />
        <button
          type="button"
          aria-expanded={showFilters}
          onClick={() => {
            setShowFilters((open) => !open);
          }}
          className={cn(
            "inline-flex h-11 shrink-0 items-center gap-1.5 rounded-lg border px-3.5 text-sm",
            "transition-colors duration-150 ease-out",
            activeFilterCount > 0
              ? "border-accent bg-accent text-accent-ink"
              : "border-line bg-surface text-ink-muted hover:border-line-strong hover:text-ink",
          )}
        >
          <SlidersHorizontal aria-hidden className="size-4" />
          Filtros
          {activeFilterCount > 0 && (
            <span className="font-mono tabular-nums">{activeFilterCount}</span>
          )}
        </button>
      </div>

      {showFilters && (
        <div className="rounded-xl border border-line bg-surface p-4">
          <ExerciseFilterBar
            filters={query.filters}
            activeCount={activeFilterCount}
            onChange={setFilters}
            onClear={clear}
          />
        </div>
      )}

      {writeError !== null && (
        <p
          role="alert"
          className="rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-ink"
        >
          {writeError}
        </p>
      )}

      {state.status === "loading" && <Skeleton />}

      {state.status === "error" && (
        <div
          role="alert"
          className="rounded-xl border border-danger/30 bg-danger/5 px-6 py-8 text-center"
        >
          <p className="text-ink">Não foi possível carregar os exercícios.</p>
          <p className="mt-1.5 text-sm text-ink-muted">{state.message}</p>
        </div>
      )}

      {state.status === "ready" && (
        <>
          <p className="text-sm text-ink-subtle" role="status" aria-live="polite">
            {results.length === 0
              ? "Nenhum exercício encontrado"
              : `${results.length} ${results.length === 1 ? "exercício" : "exercícios"}`}
          </p>

          {results.length === 0 ? (
            <EmptyState
              hasQuery={query.text !== "" || activeFilterCount > 0}
              onClear={clear}
            />
          ) : (
            <div className="overflow-hidden rounded-xl border border-line bg-surface">
              <ul className="divide-y divide-line">
                {results.map((exercise) => (
                  <ExerciseRow
                    key={exercise.id}
                    exercise={exercise}
                    onToggleFavorite={(item) => void toggleFavorite(item)}
                    onSelect={onSelect}
                  />
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function EmptyState({
  hasQuery,
  onClear,
}: {
  readonly hasQuery: boolean;
  readonly onClear: () => void;
}) {
  return (
    <div className="rounded-xl border border-dashed border-line px-6 py-14 text-center">
      <p className="text-ink">
        {hasQuery
          ? "Nenhum exercício corresponde à busca."
          : "Nenhum exercício no banco."}
      </p>
      <p className="mt-1.5 text-sm text-ink-subtle">
        {hasQuery
          ? "Tente outro termo ou remova alguns filtros."
          : "Recarregue a página para preencher o banco automaticamente."}
      </p>
      {hasQuery && (
        <button
          type="button"
          onClick={onClear}
          className="mt-4 text-sm text-ink underline underline-offset-4"
        >
          Limpar busca e filtros
        </button>
      )}
    </div>
  );
}

function Skeleton() {
  const widths = ["w-48", "w-64", "w-40", "w-56", "w-44", "w-52", "w-36", "w-60"];

  return (
    <div
      aria-hidden
      className="overflow-hidden rounded-xl border border-line bg-surface"
    >
      <ul className="divide-y divide-line">
        {widths.map((width, index) => (
          <li key={index} className="flex items-center gap-3 px-3 py-2.5">
            <div className="size-8 shrink-0 rounded-md bg-muted" />
            <div className="flex-1 space-y-2">
              <div className={`h-3.5 ${width} rounded bg-muted`} />
              <div className="h-2.5 w-32 rounded bg-muted" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
