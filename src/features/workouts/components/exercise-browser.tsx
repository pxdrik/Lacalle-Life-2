"use client";

import { noticeClasses } from "@/design-system/components/notice";
import { Skeleton } from "@/design-system/components/skeleton";
import { Plus, SlidersHorizontal } from "lucide-react";
import { useState } from "react";

import { cn } from "@/design-system/cn";
import { Button, buttonClasses } from "@/design-system/components/button";
import { Card } from "@/design-system/components/card";
import { Dialog } from "@/design-system/components/dialog";
import { Input } from "@/design-system/components/input";

import { useExerciseCatalogue } from "../hooks/use-exercise-catalogue";
import { useExerciseQuery } from "../hooks/use-exercise-query";
import { filterExercises } from "../services/filter-exercises";
import { searchExercises } from "../services/search-exercises";
import type { Exercise } from "../types/exercise";
import { CustomExerciseForm } from "./custom-exercise-form";
import {
  ExerciseDetailDialog,
  useExerciseDetail,
} from "./exercise-detail-dialog";
import { ExerciseFilterBar } from "./exercise-filter-bar";
import { ExerciseRow } from "./exercise-row";
import { THUMBNAIL_BOX } from "./exercise-thumbnail";
import { MediaAttribution } from "./media-attribution";

interface Props {
  /**
   * Present in selection mode: every row gains an add button and reports the
   * exercise back. Absent while browsing.
   *
   * This is the seam that lets the workout builder mount the same screen
   * instead of growing a second, divergent exercise list.
   */
  readonly onSelect?: (exercise: Exercise) => void;

  /**
   * Whether the search and filters are mirrored into the URL.
   *
   * True on the catalogue page, where a filtered view is worth bookmarking.
   * False inside a picker, where they are scratch state and would otherwise
   * bury the routine's own URL under `?m=chest&e=barbell`.
   */
  readonly persistQuery?: boolean;
}

export function ExerciseBrowser({ onSelect, persistQuery = true }: Props) {
  const { state, writeError, toggleFavorite, createExercise } =
    useExerciseCatalogue();
  const { query, activeFilterCount, setText, setFilters, clear } =
    useExerciseQuery(persistQuery);
  const detail = useExerciseDetail();
  const [showFilters, setShowFilters] = useState(false);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);

  // Search then filter, both on every render. The catalogue is a few hundred
  // rows over a prepared index, so this costs microseconds — and derived state
  // that can fall out of sync with its inputs is a bug waiting to happen.
  const results =
    state.status === "ready"
      ? filterExercises(searchExercises(state.index, query.text), query.filters)
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
        {/* Same rule as `/alimentos`: the label folds away on a phone and the
            glyph carries it. `aria-label` rather than an `sr-only` span, so
            one attribute names the control at every width instead of two
            spans taking turns. */}
        <button
          type="button"
          aria-label="Filtros"
          aria-expanded={showFilters}
          onClick={() => {
            setShowFilters((open) => !open);
          }}
          className={cn(
            // Same control, same recipe, on both screens. Active is the
            // system's `primary` rather than `secondary` patched with an
            // accent border: the filled variant already carries the right
            // hover and active opacity, where overriding `secondary` would
            // leave `hover:bg-muted` behind and wash the state out on hover.
            buttonClasses(activeFilterCount > 0 ? "primary" : "secondary"),
          )}
        >
          <SlidersHorizontal aria-hidden className="size-4" />
          <span className="hidden sm:inline">Filtros</span>
          {activeFilterCount > 0 && (
            <span className="tabular-nums">{activeFilterCount}</span>
          )}
        </button>
      </div>

      {/* A sheet, not a panel that grows in place.
          Expanding inline pushed the whole catalogue down by the height of
          nineteen muscle chips, so choosing a filter and then reading the
          result meant scrolling back past the thing you just used. Overlaying
          costs the list from view, which is why the count below moves as you
          choose — that number is the result, before you close anything. */}
      <Dialog
        open={showFilters}
        title="Filtros"
        onClose={() => {
          setShowFilters(false);
        }}
        // Pinned to the bottom edge explicitly rather than pushed there with
        // `mt-auto`, which left the sheet hanging 8px past the viewport.
        className="max-sm:inset-x-0 max-sm:top-auto max-sm:bottom-0 max-sm:m-0 max-sm:w-full max-sm:max-w-none max-sm:rounded-b-none"
      >
        <ExerciseFilterBar
          filters={query.filters}
          activeCount={activeFilterCount}
          onChange={setFilters}
          onClear={clear}
        />

        {/* Sticky, because it is the payoff. Nineteen muscle chips plus
            equipment, movement and difficulty run past the fold on a phone,
            and a count that only appears after scrolling to the end is a count
            nobody reads while choosing. */}
        <div className="sticky -bottom-5 -mx-5 -mb-5 mt-5 flex items-center justify-between gap-3 border-t border-line bg-surface px-5 py-4">
          <p aria-live="polite" className="text-sm text-ink-muted">
            <span className="tabular-nums text-ink">{results.length}</span>{" "}
            {results.length === 1 ? "exercício" : "exercícios"}
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

      {creating && (
        <CustomExerciseForm
          initialName={query.text}
          pending={saving}
          onCancel={() => {
            setCreating(false);
          }}
          onSubmit={(input) => {
            setSaving(true);
            void createExercise(input).then((created) => {
              setSaving(false);
              if (created === null) return;

              setCreating(false);
              // Clearing the search is what makes the new exercise visible:
              // it rarely matches the term that failed to find anything.
              setText("");
              // In selection mode it goes straight into the routine, so
              // "not in the catalogue" costs one detour and not two.
              onSelect?.(created);
            });
          }}
        />
      )}

      {state.status === "loading" && <ListSkeleton />}

      {state.status === "error" && (
        <div role="alert" className={noticeClasses("danger", "block")}>
          <p className="text-ink">Não foi possível carregar os exercícios.</p>
          <p className="mt-1.5 text-sm text-ink-muted">{state.message}</p>
        </div>
      )}

      {state.status === "ready" && (
        <>
          <p
            className="text-sm text-ink-subtle"
            role="status"
            aria-live="polite"
          >
            {results.length === 0
              ? "Nenhum exercício encontrado"
              : `${results.length} ${results.length === 1 ? "exercício" : "exercícios"}`}
          </p>

          {results.length === 0 ? (
            <EmptyState
              searchText={query.text}
              hasQuery={query.text !== "" || activeFilterCount > 0}
              onClear={clear}
              onCreate={() => {
                setCreating(true);
              }}
            />
          ) : (
            <Card padded={false} className="overflow-hidden">
              <ul className="divide-y divide-line">
                {results.map((exercise) => (
                  <ExerciseRow
                    key={exercise.id}
                    exercise={exercise}
                    onToggleFavorite={(item) => void toggleFavorite(item)}
                    onSelect={onSelect}
                    onOpenDetail={detail.show}
                  />
                ))}

                {/* Creating used to be reachable only from the empty state,
                    which made it unreachable in the case that actually happens:
                    searching "supino", getting eight results, and wanting the
                    variation your gym has that none of them is. You had to
                    type nonsense to get the option back.

                    Offered while searching and never while browsing — a
                    standing button over 183 curated exercises invites
                    duplicates of entries already there. */}
                {query.text.trim() !== "" && (
                  <li>
                    <button
                      type="button"
                      onClick={() => {
                        setCreating(true);
                      }}
                      className={cn(
                        "flex w-full items-center gap-2 px-4 py-3 text-left text-sm",
                        "text-ink-muted transition-colors duration-150 ease-out",
                        "hover:bg-muted hover:text-ink",
                      )}
                    >
                      <Plus aria-hidden className="size-4 shrink-0" />
                      <span className="min-w-0 truncate">
                        Criar “{query.text.trim()}”
                      </span>
                    </button>
                  </li>
                )}
              </ul>
            </Card>
          )}

          {/* Credit is owed where the work is shown, and only there — so it
              is derived from the rows on screen, not from a fixed list. */}
          <MediaAttribution media={results.map((exercise) => exercise.media)} />

          <ExerciseDetailDialog control={detail} />
        </>
      )}
    </div>
  );
}

/**
 * Coming up empty is the moment someone is most likely to give up, so it is
 * the moment the escape hatch has to be most obvious: creating the exercise is
 * the primary action here, not a footnote under "try another term".
 */
function EmptyState({
  searchText,
  hasQuery,
  onClear,
  onCreate,
}: {
  readonly searchText: string;
  readonly hasQuery: boolean;
  readonly onClear: () => void;
  readonly onCreate: () => void;
}) {
  return (
    <Card tone="quiet" className="text-center">
      <p className="text-ink">
        {hasQuery
          ? "Nenhum exercício corresponde à busca."
          : "Nenhum exercício no banco."}
      </p>

      {hasQuery ? (
        <>
          <p className="mt-1.5 text-sm text-ink-subtle">
            O que você faz não está no catálogo? Crie e use agora mesmo.
          </p>
          <div className="mt-5 flex flex-col items-center gap-3">
            <Button onClick={onCreate}>
              <Plus aria-hidden className="size-4" />
              {searchText.trim() === ""
                ? "Criar exercício"
                : `Criar “${searchText.trim()}”`}
            </Button>
            <button
              type="button"
              onClick={onClear}
              className="text-sm text-ink-muted underline underline-offset-4 hover:text-ink"
            >
              Limpar busca e filtros
            </button>
          </div>
        </>
      ) : (
        <p className="mt-1.5 text-sm text-ink-subtle">
          Recarregue a página para preencher o banco automaticamente.
        </p>
      )}
    </Card>
  );
}

function ListSkeleton() {
  const widths = [
    "w-48",
    "w-64",
    "w-40",
    "w-56",
    "w-44",
    "w-52",
    "w-36",
    "w-60",
  ];

  return (
    <Card aria-hidden padded={false} className="overflow-hidden">
      <ul className="divide-y divide-line">
        {widths.map((width, index) => (
          <li key={index} className="flex items-center gap-3 px-3 py-2.5">
            <Skeleton className={`${THUMBNAIL_BOX} shrink-0`} />
            <div className="flex-1 space-y-2">
              <Skeleton className={`h-3.5 ${width}`} />
              <Skeleton className="h-2.5 w-32" />
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
