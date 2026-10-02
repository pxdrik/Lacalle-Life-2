"use client";

import { Copy, NotebookPen } from "lucide-react";
import { useState } from "react";

import { formatDecimal } from "@/core/format/decimal";
import { Card } from "@/design-system/components/card";
import { Dialog } from "@/design-system/components/dialog";

import { itemMacros, mealMacros } from "../services/diet-macros";
import type { Meal, MealItem } from "../types/diet";
import { MacroSummary } from "./macro-summary";

/**
 * Uma refeição do plano, só leitura: a orientação da nutricionista
 * (`notes`), os alimentos e, quando ela deixou, as outras opções numa folha.
 * Escolher a opção do dia é no Diário, não aqui.
 */
export function PrescribedMealCard({ meal, professionalName }: { readonly meal: Meal; readonly professionalName: string }) {
  const [showOptions, setShowOptions] = useState(false);
  const alternatives = meal.alternatives ?? [];

  return (
    <Card as="li" className="space-y-3">
      <div>
        <p className="font-medium break-words text-ink">{meal.name}</p>
        {meal.time !== null && <p className="text-xs text-ink-muted">{meal.time}</p>}
      </div>

      {meal.notes.trim() !== "" && (
        <p className="flex gap-2 text-sm break-words text-ink-muted">
          <NotebookPen aria-hidden className="mt-0.5 size-4 shrink-0 text-accent-text" />
          <span className="min-w-0">{meal.notes}</span>
        </p>
      )}

      {alternatives.length > 0 && (
        <button
          type="button"
          onClick={() => {
            setShowOptions(true);
          }}
          className="flex min-h-11 items-center gap-1.5 text-sm font-medium text-accent-text underline-offset-4 hover:underline"
        >
          <Copy aria-hidden className="size-4 shrink-0" />
          Mais {alternatives.length} {alternatives.length === 1 ? "opção" : "opções"} para esta refeição
        </button>
      )}

      <MacroSummary macros={mealMacros(meal)} />
      <ItemList items={meal.items} />

      {alternatives.length > 0 && (
        <Dialog
          open={showOptions}
          title={`Opções para ${meal.name}`}
          onClose={() => {
            setShowOptions(false);
          }}
          placement="sheet-bottom"
        >
          <p className="text-sm text-ink-muted">
            {professionalName} deixou outras formas de fazer esta refeição. No Diário, você escolhe qual vai comer em cada
            dia.
          </p>
          <ul className="mt-4 space-y-2">
            {[{ id: "principal", name: "Principal", items: meal.items }, ...alternatives].map((option) => (
              <Card as="li" key={option.id} className="space-y-2">
                <p className="font-medium break-words text-ink">{option.name}</p>
                <MacroSummary macros={mealMacros({ ...meal, items: option.items })} />
                <ItemList items={option.items} />
              </Card>
            ))}
          </ul>
        </Dialog>
      )}
    </Card>
  );
}

function ItemList({ items }: { readonly items: readonly MealItem[] }) {
  if (items.length === 0) return <p className="text-sm text-ink-subtle">Nenhum alimento.</p>;
  return (
    <ul className="divide-y divide-line border-t border-line">
      {items.map((item) => (
        <li key={item.id} className="flex items-baseline gap-3 py-2 text-sm">
          <span className="min-w-0 flex-1 break-words text-ink">{item.name}</span>
          <span className="shrink-0 text-ink-muted tabular-nums">
            {formatDecimal(item.grams)} {item.unit}
          </span>
          <span className="w-16 shrink-0 text-right text-ink-subtle tabular-nums">
            {formatDecimal(itemMacros(item).kcal, 0)} kcal
          </span>
        </li>
      ))}
    </ul>
  );
}
