"use client";

import { Plus, SlidersHorizontal, X } from "lucide-react";
import { useState } from "react";

import { formatDecimal } from "@/core/format/decimal";
import { roundMacros, scaleMacros } from "@/core/domain/macros";
import { cn } from "@/design-system/cn";
import { buttonClasses } from "@/design-system/components/button";
import { Input } from "@/design-system/components/input";
import { useIncrementalReveal } from "@/design-system/hooks/use-incremental-reveal";
import { MACRO_CODING } from "@/design-system/macros";

import { useFoodCatalogue } from "../hooks/use-food-catalogue";
import { useFoodEditor } from "../hooks/use-food-editor";
import { searchFoods } from "../services/search-foods";
import type { Food, FoodCategory } from "../types/food";
import { FOOD_CATEGORY_LABELS } from "../types/food";
import { CustomFoodForm } from "./custom-food-form";
import { FoodFilters } from "./food-filters";

interface Props {
  readonly onPick: (food: Food) => void;
  readonly onCancel: () => void;
}

/**
 * Pick a food, inline.
 *
 * Not a dialog: this opens inside the meal it is adding to, so the meal stays
 * visible and there is no focus trap, scroll lock or escape handling to get
 * subtly wrong. One keystroke to filter, one click to add.
 *
 * Results used to be capped at 8 — "rendering all 216 makes the first
 * keystroke slower for everyone". That comment was right about the risk and
 * wrong about the fix: capping the result *count* also capped what the
 * picker could ever show, which is why category and favourites filters never
 * had anywhere to go here. `useIncrementalReveal` (BUG-011, Sprint 6) caps
 * how many rows *mount*, not how many can exist — the same fix the full
 * catalogues already use — so the list can be complete without the
 * first-keystroke cost coming back. The results pane keeps its own scroll
 * rather than growing into the meal below it, which is the one way this
 * picker differs from a full-page browser: it lives inside an editing flow
 * that should not be pushed around by how many rows matched.
 */
const RESULT_PAGE_SIZE = 20;

export function FoodPicker({ onPick, onCancel }: Props) {
  const { state } = useFoodCatalogue();
  const [text, setText] = useState("");
  const [category, setCategory] = useState<FoodCategory | null>(null);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const activeFilterCount = (category === null ? 0 : 1) + (favoritesOnly ? 1 : 0);

  // The same create/edit machinery `/alimentos/novo` uses — `id: null` means
  // creating. Reusing it here, instead of a second write path, is the whole
  // point: this picker never has its own idea of what a valid food is.
  const [creating, setCreating] = useState(false);
  const editor = useFoodEditor(null);

  const results =
    state.status === "ready"
      ? searchFoods(state.foods, { text, category, favoritesOnly })
      : [];

  // Called unconditionally, above the `creating` branch below — hooks can't
  // follow an early return, even one that never needs this value.
  const { count, hasMore, sentinelRef } = useIncrementalReveal(
    `${text}|${category ?? ""}|${String(favoritesOnly)}`,
    results.length,
    RESULT_PAGE_SIZE,
  );
  const visible = results.slice(0, count);

  if (creating) {
    return (
      <div className="space-y-3 rounded-lg border border-line bg-canvas p-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-ink">Criar alimento</h2>
          <button
            type="button"
            onClick={() => {
              setCreating(false);
            }}
            className="text-sm text-ink-muted underline underline-offset-4 hover:text-ink"
          >
            Voltar à busca
          </button>
        </div>

        <CustomFoodForm
          initial={null}
          save={editor.save}
          pending={editor.pending}
          error={editor.error}
          initialName={text}
          onCancel={() => {
            setCreating(false);
          }}
          onSaved={(food) => {
            setCreating(false);
            onPick(food);
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-lg border border-line bg-canvas p-2">
      <div className="flex gap-2">
        <Input
          // The picker only opens on an explicit click, so taking focus is
          // what the user just asked for.
          autoFocus
          type="search"
          value={text}
          onChange={(event) => {
            setText(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") onCancel();
          }}
          placeholder="Buscar alimento"
          aria-label="Buscar alimento para adicionar"
          autoComplete="off"
          disabled={state.status !== "ready"}
        />
        <button
          type="button"
          aria-label="Filtros"
          aria-expanded={showFilters}
          onClick={() => {
            setShowFilters((open) => !open);
          }}
          className={cn(
            "shrink-0",
            buttonClasses(activeFilterCount > 0 ? "primary" : "secondary"),
            // Matches the field beside it: `--control-h` varies with density,
            // `--input-h` stays fixed at 44px on purpose (input.tsx).
            "h-(--input-h)",
          )}
        >
          <SlidersHorizontal aria-hidden className="size-4" />
          {activeFilterCount > 0 && (
            <span className="tabular-nums">{activeFilterCount}</span>
          )}
        </button>
        {/* Escape closes it too, but a touch keyboard has no Escape — leaving
            only that would strand every phone. */}
        <button
          type="button"
          onClick={onCancel}
          aria-label="Fechar busca"
          className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-line text-ink-subtle transition-colors duration-150 ease-out hover:border-line-strong hover:text-ink"
        >
          <X aria-hidden className="size-4" />
        </button>
      </div>

      {showFilters && (
        <div className="rounded-md border border-line bg-surface p-2">
          <FoodFilters
            category={category}
            favoritesOnly={favoritesOnly}
            onCategoryChange={setCategory}
            onFavoritesOnlyChange={setFavoritesOnly}
          />
        </div>
      )}

      {state.status === "error" && (
        <p role="alert" className="px-2 py-3 text-sm text-ink-muted">
          {state.message}
        </p>
      )}

      {state.status === "ready" && (
        <button
          type="button"
          onClick={() => {
            setCreating(true);
          }}
          className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-ink-muted transition-colors duration-150 ease-out hover:bg-muted hover:text-ink"
        >
          <Plus aria-hidden className="size-4" />
          {/* Não é só para quando a busca falha: às vezes o alimento que
              existe não é o que a pessoa quer registrar (marca diferente,
              preparo diferente), e a ação precisa estar à mão o tempo
              todo — não só aparecer depois de "nenhum alimento
              encontrado". */}
          {text.trim() === "" ? "Criar alimento" : `Criar "${text.trim()}"`}
        </button>
      )}

      {state.status === "ready" && results.length === 0 && (
        <p className="px-2 py-3 text-sm text-ink-subtle">
          Nenhum alimento encontrado.
        </p>
      )}

      {results.length > 0 && (
        <ul className="max-h-72 overflow-y-auto">
          {visible.map((food) => {
            const portion = referencePortion(food);
            const macros = roundMacros(scaleMacros(food.per100g, portion.grams));

            return (
              <li key={food.id}>
                <button
                  type="button"
                  onClick={() => {
                    onPick(food);
                    // Cleared so the next food can be typed straight away.
                    // The picker stays open because adding several foods to
                    // one meal is the normal case. Filters survive the pick
                    // on purpose — adding several foods from the same
                    // category is exactly what they are for.
                    setText("");
                  }}
                  className="flex w-full min-h-11 items-center gap-3 rounded-md px-2 py-2 text-left transition-colors duration-100 ease-out hover:bg-muted"
                >
                  {/* The name used to be a single truncated line, squeezed
                      between the category and the kcal column — unreadable
                      for anything longer than a few letters at a phone
                      width. It wraps now (category moved below it) instead
                      of cutting off; the row is a real button end to end
                      either way. */}
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm text-ink">{food.name}</span>
                    <span className="mt-0.5 block text-xs text-ink-subtle">
                      {FOOD_CATEGORY_LABELS[food.category]}
                      {" · "}
                      {portion.label}
                    </span>
                  </span>

                  {/* Achado de teste manual real: um número solto de kcal,
                      sem dizer se é por 100 g ou pela porção, obrigava a
                      abrir o alimento pra saber o que ele realmente traz — o
                      mesmo problema que a referência do app Macros resolve
                      mostrando nome, porção, kcal e os três macros juntos
                      numa linha só. Os valores aqui já vêm na porção de
                      referência (a medida caseira, quando existe — senão os
                      mesmos 100 g do resto do catálogo), e os macros usam a
                      cor que o app já usa em toda outra tela — nunca uma cor
                      nova só pra esta lista. */}
                  <span className="shrink-0 text-right text-xs tabular-nums">
                    <span className="block text-ink-muted">
                      {formatDecimal(macros.kcal)} kcal
                    </span>
                    <span className="mt-0.5 flex items-baseline justify-end gap-1.5">
                      {MACRO_CODING.map(({ key, text }) => (
                        <span key={key} className={text}>
                          {formatDecimal(macros[key], 1)}
                        </span>
                      ))}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}

          {hasMore && <li ref={sentinelRef} aria-hidden className="h-px" />}
        </ul>
      )}
    </div>
  );
}

/**
 * What the kcal/macro column of a result row is measured against.
 *
 * The medida caseira when the food has one — because that is the quantity
 * someone actually pictures ("1 pão", "1 ovo"), not an abstract 100 g — and
 * 100 g otherwise, since that is what `per100g` already is and no invented
 * number would be more honest than the one the catalogue actually carries.
 */
function referencePortion(food: Food): { readonly grams: number; readonly label: string } {
  return food.practicalUnit === undefined
    ? { grams: 100, label: "100 g" }
    : { grams: food.practicalUnit.grams, label: food.practicalUnit.label };
}
