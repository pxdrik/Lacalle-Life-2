"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { FoodPicker, type Food } from "@/features/foods";

import { mealMacros } from "../services/diet-macros";
import type { Meal, MealItem } from "../types/diet";
import { InlineText } from "./inline-text";
import { MacroSummary } from "./macro-summary";
import { MealItemRow } from "./meal-item-row";

interface Props {
  readonly meal: Meal;
  readonly onChange: (changes: Partial<Pick<Meal, "name" | "time" | "notes">>) => void;
  readonly onRemove: () => void;
  readonly onAddFood: (food: Food) => void;
  readonly onItemGramsChange: (itemId: string, grams: number) => void;
  readonly onRemoveItem: (itemId: string) => void;
}

export function MealCard({
  meal,
  onChange,
  onRemove,
  onAddFood,
  onItemGramsChange,
  onRemoveItem,
}: Props) {
  const [picking, setPicking] = useState(false);
  const macros = mealMacros(meal);

  return (
    <section className="rounded-xl border border-line bg-surface p-4">
      <header className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <InlineText
            value={meal.name}
            onChange={(name) => {
              onChange({ name });
            }}
            label="Nome da refeição"
            placeholder="Refeição"
            className="w-full text-base font-medium"
          />

          <div className="mt-1 flex items-center gap-2">
            <input
              type="time"
              value={meal.time ?? ""}
              aria-label={`Horário de ${meal.name}`}
              onChange={(event) => {
                // An empty field means "no fixed time", which is different
                // from midnight.
                onChange({ time: event.target.value === "" ? null : event.target.value });
              }}
              className="-mx-1 rounded-md border border-transparent bg-transparent px-1 py-0.5 font-mono text-xs tabular-nums text-ink-muted transition-colors duration-150 ease-out hover:border-line focus:border-line-strong focus:bg-surface"
            />
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <MacroSummary macros={macros} />
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Excluir ${meal.name}`}
            className="flex size-8 items-center justify-center rounded-md text-ink-subtle transition-colors duration-150 ease-out hover:bg-danger/10 hover:text-danger"
          >
            <Trash2 aria-hidden className="size-4" />
          </button>
        </div>
      </header>

      {meal.items.length > 0 && (
        <ul className="mt-3 divide-y divide-line border-t border-line pt-1">
          {meal.items.map((item: MealItem) => (
            <MealItemRow
              key={item.id}
              item={item}
              onGramsChange={(grams) => {
                onItemGramsChange(item.id, grams);
              }}
              onRemove={() => {
                onRemoveItem(item.id);
              }}
            />
          ))}
        </ul>
      )}

      <div className="mt-3">
        {picking ? (
          <FoodPicker
            onPick={onAddFood}
            onCancel={() => {
              setPicking(false);
            }}
          />
        ) : (
          <button
            type="button"
            onClick={() => {
              setPicking(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-ink-muted transition-colors duration-150 ease-out hover:bg-muted hover:text-ink"
          >
            <Plus aria-hidden className="size-4" />
            Adicionar alimento
          </button>
        )}
      </div>

      <div className="mt-3">
        <InlineText
          value={meal.notes}
          onChange={(notes) => {
            onChange({ notes });
          }}
          label={`Observações de ${meal.name}`}
          placeholder="Observações"
          className="w-full text-sm text-ink-muted"
        />
      </div>
    </section>
  );
}
