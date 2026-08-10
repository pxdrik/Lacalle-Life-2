"use client";

import { X } from "lucide-react";
import { useState } from "react";

import { Input } from "@/design-system/components/input";

import { useFoodCatalogue } from "../hooks/use-food-catalogue";
import { searchFoods } from "../services/search-foods";
import type { Food } from "../types/food";
import { FOOD_CATEGORY_LABELS } from "../types/food";

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
 * Results are capped. Someone scrolling 216 rows in a picker has already
 * given up on searching, and rendering them all makes the first keystroke
 * slower for everyone.
 */
const LIMIT = 8;

export function FoodPicker({ onPick, onCancel }: Props) {
  const { state } = useFoodCatalogue();
  const [text, setText] = useState("");

  const results =
    state.status === "ready"
      ? searchFoods(state.foods, {
          text,
          category: null,
          favoritesOnly: false,
        }).slice(0, LIMIT)
      : [];

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

      {state.status === "error" && (
        <p role="alert" className="px-2 py-3 text-sm text-ink-muted">
          {state.message}
        </p>
      )}

      {state.status === "ready" && results.length === 0 && (
        <p className="px-2 py-3 text-sm text-ink-subtle">
          {text === ""
            ? "Digite para buscar."
            : "Nenhum alimento encontrado com esse termo."}
        </p>
      )}

      {results.length > 0 && (
        <ul>
          {results.map((food) => (
            <li key={food.id}>
              <button
                type="button"
                onClick={() => {
                  onPick(food);
                  // Cleared so the next food can be typed straight away. The
                  // picker stays open because adding several foods to one meal
                  // is the normal case.
                  setText("");
                }}
                className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors duration-100 ease-out hover:bg-muted"
              >
                <span className="min-w-0 flex-1 truncate text-sm text-ink">
                  {food.name}
                </span>
                <span className="shrink-0 text-xs text-ink-subtle">
                  {FOOD_CATEGORY_LABELS[food.category]}
                </span>
                <span className="w-16 shrink-0 text-right text-xs tabular-nums text-ink-muted">
                  {food.per100g.kcal} kcal
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
