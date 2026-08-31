"use client";

import {
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  GripVertical,
  Pencil,
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
import { TimeField } from "@/design-system/components/time-field";
import { FoodPicker, type Food } from "@/features/foods";

import { mealMacros } from "../services/diet-macros";
import type { Meal, MealItem } from "../types/diet";
import { InlineText } from "./inline-text";
import { MacroSummary } from "./macro-summary";
import { MealItemRow } from "./meal-item-row";
import { Card } from "@/design-system/components/card";

interface Props {
  readonly meal: Meal;
  readonly position: number;
  readonly total: number;
  readonly dragHandle: {
    readonly attributes: React.HTMLAttributes<HTMLElement>;
    readonly listeners: Record<string, unknown> | undefined;
    readonly isDragging: boolean;
  };
  readonly onChange: (
    changes: Partial<Pick<Meal, "name" | "time" | "notes">>,
  ) => void;
  readonly onRemove: () => void;
  readonly onDuplicate: () => void;
  readonly onMove: (offset: number) => void;
  readonly onAddFood: (food: Food) => void;
  readonly onItemGramsChange: (itemId: string, grams: number) => void;
  readonly onItemUnitChange: (itemId: string, unit: MealItem["unit"]) => void;
  readonly onRemoveItem: (itemId: string) => void;
  readonly onReorderItems: (activeId: string, overId: string) => void;
  /** The other meals a food can be sent to. Empty when this is the only one. */
  readonly otherMeals: readonly {
    readonly id: string;
    readonly name: string;
  }[];
  readonly onSendItem: (
    itemId: string,
    targetMealId: string,
    mode: "copy" | "move",
  ) => void;
  /**
   * Whether this meal was already checked as eaten today, and whether what
   * was checked still matches the plan. `undefined` when the card has
   * nothing to do with checking at all — the button below only renders
   * when this and `onToggleChecked` are both given, which today only
   * happens for a meal in the Diário that carries `sourceDietId`/
   * `sourceMealId` (see `food-log-screen.tsx`).
   */
  readonly checkState?: "unchecked" | "checked" | "edited" | undefined;
  readonly onToggleChecked?: (() => void) | undefined;
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
  onItemUnitChange,
  onRemoveItem,
  onReorderItems,
  otherMeals,
  onSendItem,
  checkState,
  onToggleChecked,
}: Props) {
  const [picking, setPicking] = useState(false);
  const macros = mealMacros(meal);

  return (
    <Card
      as="section"
      className={cn(
        "transition-shadow duration-150 ease-out",
        dragHandle.isDragging && "border-accent shadow-modal",
      )}
    >
      {/* Wraps on a phone. The macro summary and four buttons are `shrink-0`
          and together need more room than a 390px screen has, so without this
          the whole page scrolled sideways — on the one screen that exists to
          be used on a phone. */}
      <header className="flex flex-wrap items-start gap-2">
        <button
          type="button"
          aria-label={`Reordenar ${meal.name}`}
          {...dragHandle.attributes}
          {...dragHandle.listeners}
          className="-ml-1 flex size-8 shrink-0 cursor-grab touch-none items-center justify-center touch-44 rounded-md text-ink-subtle transition-colors duration-150 ease-out hover:bg-muted hover:text-ink active:cursor-grabbing"
        >
          <GripVertical aria-hidden className="size-4" />
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <InlineText
              value={meal.name}
              onChange={(name) => {
                onChange({ name });
              }}
              label="Nome da refeição"
              placeholder="Refeição"
              className="min-w-0 flex-1 text-base font-medium"
            />

            {/* Só existe no Diário, numa refeição com proveniência — ver o
                comentário de `checkState` na prop. O mesmo padrão de
                `performed-set-row.tsx` ("Concluir série"), num tamanho
                menor: aqui é um toque por refeição, não dezenas por treino. */}
            {onToggleChecked !== undefined && (
              <button
                type="button"
                onClick={onToggleChecked}
                aria-pressed={checkState !== "unchecked"}
                aria-label={
                  checkState === "unchecked"
                    ? `Marcar ${meal.name} como comida`
                    : `Desmarcar ${meal.name} como comida`
                }
                title={
                  checkState === "edited"
                    ? "Comido, mas diferente do planejado"
                    : undefined
                }
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center touch-44 rounded-md border",
                  "transition-[background-color,border-color,color] duration-150 ease-out",
                  checkState === "unchecked" &&
                    "border-line-strong text-ink-subtle hover:border-accent hover:text-ink",
                  checkState === "checked" &&
                    "border-accent bg-accent text-accent-ink",
                  // Preenchido de leve, não sólido: a mesma refeição, comida
                  // diferente do planejado — o check ainda está lá porque
                  // *alguma coisa* foi registrada, mas sólido apagaria a
                  // diferença que o próprio ícone existe pra mostrar.
                  checkState === "edited" &&
                    "border-accent bg-accent-surface text-accent-text",
                )}
              >
                {checkState === "edited" ? (
                  <Pencil aria-hidden className="size-3.5" />
                ) : (
                  <Check aria-hidden className="size-4" />
                )}
              </button>
            )}
          </div>

          <div className="mt-1 flex items-center gap-2">
            <TimeField
              value={meal.time}
              label={`Horário de ${meal.name}`}
              onChange={(time) => {
                // `null` means "no fixed time", which is different from
                // midnight.
                onChange({ time });
              }}
              className="-mx-1 rounded-md border border-transparent bg-transparent px-1 py-0.5 text-xs text-ink-muted transition-colors duration-150 ease-out hover:border-line focus:border-line-strong focus:bg-surface"
            />
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 max-sm:order-last max-sm:w-full max-sm:flex-wrap max-sm:justify-between max-sm:gap-y-1">
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

      {/* Secundária de propósito: "Gramas"/"Unidade" acima de cada campo
          (`meal-item-row.tsx`) já identificam o número na hora. Isto é só a
          confirmação por extenso, para quem quiser ler.
          Só quando se aplica: um alimento sem medida caseira conhecida
          continua mostrando um campo de grama só, exatamente como antes
          disto existir, e a explicação seria sobre um controle que nem
          está na tela. */}
      {meal.items.some((item) => item.practicalUnit !== undefined) && (
        <p className="mt-3 text-xs text-ink-subtle">
          Gramas é o peso do alimento. Unidade, quando aparece, é quantas
          medidas dele, por exemplo 2 em &quot;1/2 xícara&quot;, e se
          converte em grama sozinha.
        </p>
      )}

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
                    onUnitChange={(unit) => {
                      onItemUnitChange(item.id, unit);
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
    </Card>
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
      className="flex size-8 items-center justify-center touch-44 rounded-md text-ink-subtle transition-colors duration-150 ease-out hover:bg-muted hover:text-ink disabled:opacity-30"
    >
      {children}
    </button>
  );
}
