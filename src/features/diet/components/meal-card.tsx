"use client";

import {
  ChevronDown,
  ChevronUp,
  Copy,
  GripVertical,
  Plus,
  Trash2,
} from "lucide-react";
import { useState } from "react";

import { cn } from "@/design-system/cn";
import { ConfirmButton } from "@/design-system/components/confirm-button";
import {
  SortableItem,
  SortableList,
} from "@/design-system/components/sortable-list";
import { FoodPicker, type Food } from "@/features/foods";

import { mealMacros } from "../services/diet-macros";
import type { Meal, MealItem } from "../types/diet";
import { InlineText } from "./inline-text";
import { MacroSummary } from "./macro-summary";
import { MealItemRow } from "./meal-item-row";

interface Props {
  readonly meal: Meal;
  readonly position: number;
  readonly total: number;
  readonly dragHandle: {
    readonly attributes: React.HTMLAttributes<HTMLElement>;
    readonly listeners: Record<string, unknown> | undefined;
    readonly isDragging: boolean;
  };
  readonly onChange: (changes: Partial<Pick<Meal, "name" | "time" | "notes">>) => void;
  readonly onRemove: () => void;
  readonly onDuplicate: () => void;
  readonly onMove: (offset: number) => void;
  readonly onAddFood: (food: Food) => void;
  readonly onItemGramsChange: (itemId: string, grams: number) => void;
  readonly onRemoveItem: (itemId: string) => void;
  readonly onReorderItems: (activeId: string, overId: string) => void;
  /** The other meals a food can be sent to. Empty when this is the only one. */
  readonly otherMeals: readonly { readonly id: string; readonly name: string }[];
  readonly onSendItem: (
    itemId: string,
    targetMealId: string,
    mode: "copy" | "move",
  ) => void;
}

export function MealCard({
  meal,
  position,
  total,
  dragHandle,
  onChange,
  onRemove,
  onDuplicate,
  onMove,
  onAddFood,
  onItemGramsChange,
  onRemoveItem,
  onReorderItems,
  otherMeals,
  onSendItem,
}: Props) {
  const [picking, setPicking] = useState(false);
  const macros = mealMacros(meal);

  return (
    <section
      className={cn(
        "rounded-xl border bg-surface p-4 transition-shadow duration-150 ease-out",
        dragHandle.isDragging ? "border-accent shadow-md" : "border-line",
      )}
    >
      <header className="flex items-start gap-2">
        <button
          type="button"
          aria-label={`Reordenar ${meal.name}`}
          {...dragHandle.attributes}
          {...dragHandle.listeners}
          className="-ml-1 flex size-8 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-ink-subtle transition-colors duration-150 ease-out hover:bg-muted hover:text-ink active:cursor-grabbing"
        >
          <GripVertical aria-hidden className="size-4" />
        </button>

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

        <div className="flex shrink-0 items-center gap-2">
          <MacroSummary macros={macros} />

          {/* Arrows alongside the handle, for the same reason as in a routine:
              dragging is an accelerator, not the only path. */}
          <div className="flex items-center">
            <MoveButton
              label={`Duplicar ${meal.name}`}
              disabled={false}
              onClick={onDuplicate}
            >
              <Copy aria-hidden className="size-4" />
            </MoveButton>
            <MoveButton
              label={`Mover ${meal.name} para cima`}
              disabled={position === 0}
              onClick={() => {
                onMove(-1);
              }}
            >
              <ChevronUp aria-hidden className="size-4" />
            </MoveButton>
            <MoveButton
              label={`Mover ${meal.name} para baixo`}
              disabled={position === total - 1}
              onClick={() => {
                onMove(1);
              }}
            >
              <ChevronDown aria-hidden className="size-4" />
            </MoveButton>
            <ConfirmButton
              onConfirm={onRemove}
              label={`Excluir ${meal.name}`}
              confirmLabel="Excluir?"
              className="h-8 min-w-8"
            >
              <Trash2 aria-hidden className="size-4" />
            </ConfirmButton>
          </div>
        </div>
      </header>

      {meal.items.length > 0 && (
        <SortableList
          ids={meal.items.map((item) => item.id)}
          describe={(id) =>
            meal.items.find((item) => item.id === id)?.name ?? "alimento"
          }
          onReorder={onReorderItems}
        >
          <ul className="mt-3 divide-y divide-line border-t border-line pt-1">
            {meal.items.map((item: MealItem) => (
              <SortableItem key={item.id} id={item.id}>
                {(handle) => (
                  <MealItemRow
                    item={item}
                    dragHandle={handle}
                    otherMeals={otherMeals}
                    onGramsChange={(grams) => {
                      onItemGramsChange(item.id, grams);
                    }}
                    onRemove={() => {
                      onRemoveItem(item.id);
                    }}
                    onSend={(targetMealId, mode) => {
                      onSendItem(item.id, targetMealId, mode);
                    }}
                  />
                )}
              </SortableItem>
            ))}
          </ul>
        </SortableList>
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

function MoveButton({
  label,
  onClick,
  disabled,
  children,
}: {
  readonly label: string;
  readonly onClick: () => void;
  readonly disabled: boolean;
  readonly children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="flex size-8 items-center justify-center rounded-md text-ink-subtle transition-colors duration-150 ease-out hover:bg-muted hover:text-ink disabled:opacity-30"
    >
      {children}
    </button>
  );
}
