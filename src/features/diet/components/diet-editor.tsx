"use client";

import { cn } from "@/design-system/cn";
import { Button } from "@/design-system/components/button";
import { Card } from "@/design-system/components/card";
import { noticeClasses } from "@/design-system/components/notice";
import { PAGE_SHELL_BLEED } from "@/design-system/components/page-shell";
import { Skeleton } from "@/design-system/components/skeleton";
import { ArrowLeft, Plus } from "lucide-react";
import Link from "next/link";

import {
  SortableItem,
  SortableList,
} from "@/design-system/components/sortable-list";
import type { Food } from "@/features/foods";
import { useNutritionTargets } from "@/features/profile";

import { useDietEditor } from "../hooks/use-diet-editor";
import { createMealItem, DEFAULT_GRAMS } from "../services/create-diet";
import { dietMacros } from "../services/diet-macros";
import {
  addItem,
  addMeal,
  copyItemToMeal,
  duplicateMeal,
  moveItemToMeal,
  moveMeal,
  removeItem,
  removeMeal,
  renameDiet,
  reorderMealItems,
  reorderMeals,
  setItemGrams,
  setItemUnit,
  updateMeal,
} from "../services/edit-diet";
import { MealCard } from "./meal-card";
import { InlineText } from "./inline-text";
import { MacroProgress } from "./macro-progress";
import { MacroSummary } from "./macro-summary";

export function DietEditor({ dietId }: { readonly dietId: string }) {
  const { state, saveError, hasConflict, apply, reload } = useDietEditor(dietId);
  // `null` whenever no profile is filled in, which is the normal case.
  const targets = useNutritionTargets();

  if (state.status === "loading") return <EditorSkeleton />;

  if (state.status === "missing") {
    return (
      <Notice title="Esta dieta não existe.">
        Ela pode ter sido excluída, ou o link pode estar errado.
      </Notice>
    );
  }

  if (state.status === "error") {
    return (
      <Notice title="Não foi possível abrir a dieta.">{state.message}</Notice>
    );
  }

  const { diet } = state;
  const totals = dietMacros(diet);

  return (
    <div>
      <Link
        href="/dietas"
        className="inline-flex items-center gap-1.5 text-sm text-ink-muted transition-colors duration-150 ease-out hover:text-ink"
      >
        <ArrowLeft aria-hidden className="size-4" />
        Dietas
      </Link>

      <InlineText
        value={diet.name}
        onChange={(name) => {
          apply((current) => renameDiet(current, name));
        }}
        label="Nome da dieta"
        placeholder="Dieta sem nome"
        className="mt-3 w-full text-2xl font-medium tracking-normal"
      />

      {/* Sticky, because the totals are the reason the screen exists: every
          portion change is a question about them. */}
      <div
        className={cn(
          PAGE_SHELL_BLEED,
          "sticky top-0 z-10 mt-4 border-b border-line bg-canvas/90 py-3 backdrop-blur",
        )}
      >
        {targets === null ? (
          <MacroSummary macros={totals} size="lg" />
        ) : (
          <MacroProgress totals={totals} targets={targets} />
        )}
      </div>

      {saveError !== null && (
        <div role="alert" className={cn("mt-4", noticeClasses())}>
          <p>{saveError}</p>
          {/* The one way out of a conflict: give up this tab's edit and
              load what is actually stored, instead of every keystroke from
              here on failing the same way. See `useDietEditor`'s doc
              comment on `reload`. */}
          {hasConflict && (
            <Button variant="secondary" size="sm" className="mt-2" onClick={reload}>
              Recarregar dados
            </Button>
          )}
        </div>
      )}

      <SortableList
        ids={diet.meals.map((meal) => meal.id)}
        describe={(id) =>
          diet.meals.find((meal) => meal.id === id)?.name ?? "refeição"
        }
        onReorder={(activeId, overId) => {
          apply((current) => reorderMeals(current, activeId, overId));
        }}
      >
        <div className="mt-5 space-y-3">
          {diet.meals.map((meal, index) => (
            <SortableItem key={meal.id} id={meal.id}>
              {(dragHandle) => (
                <MealCard
                  meal={meal}
                  position={index}
                  total={diet.meals.length}
                  dragHandle={dragHandle}
                  onChange={(changes) => {
                    apply((current) => updateMeal(current, meal.id, changes));
                  }}
                  onRemove={() => {
                    apply((current) => removeMeal(current, meal.id));
                  }}
                  onDuplicate={() => {
                    apply((current) => duplicateMeal(current, meal.id));
                  }}
                  onMove={(offset) => {
                    apply((current) => moveMeal(current, meal.id, offset));
                  }}
                  otherMeals={diet.meals
                    .filter((other) => other.id !== meal.id)
                    .map((other) => ({ id: other.id, name: other.name }))}
                  onSendItem={(itemId, targetMealId, mode) => {
                    apply((current) =>
                      mode === "copy"
                        ? copyItemToMeal(current, meal.id, itemId, targetMealId)
                        : moveItemToMeal(
                            current,
                            meal.id,
                            itemId,
                            targetMealId,
                          ),
                    );
                  }}
                  onReorderItems={(activeId, overId) => {
                    apply((current) =>
                      reorderMealItems(current, meal.id, activeId, overId),
                    );
                  }}
                  onAddFood={(food: Food) => {
                    apply((current) =>
                      addItem(
                        current,
                        meal.id,
                        createMealItem({
                          foodId: food.id,
                          name: food.name,
                          grams: DEFAULT_GRAMS,
                          per100g: food.per100g,
                        }),
                      ),
                    );
                  }}
                  onItemGramsChange={(itemId, grams) => {
                    apply((current) =>
                      setItemGrams(current, meal.id, itemId, grams),
                    );
                  }}
                  onItemUnitChange={(itemId, unit) => {
                    apply((current) =>
                      setItemUnit(current, meal.id, itemId, unit),
                    );
                  }}
                  onRemoveItem={(itemId) => {
                    apply((current) => removeItem(current, meal.id, itemId));
                  }}
                />
              )}
            </SortableItem>
          ))}
        </div>
      </SortableList>

      <button
        type="button"
        onClick={() => {
          apply(addMeal);
        }}
        className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-line py-3.5 text-sm text-ink-muted transition-colors duration-150 ease-out hover:border-line-strong hover:text-ink"
      >
        <Plus aria-hidden className="size-4" />
        Adicionar refeição
      </button>
    </div>
  );
}

function Notice({
  title,
  children,
}: {
  readonly title: string;
  readonly children: React.ReactNode;
}) {
  return (
    <Card tone="quiet" className="text-center">
      <p className="text-ink">{title}</p>
      <p className="mt-1.5 text-sm text-ink-subtle">{children}</p>
      <Link
        href="/dietas"
        className="mt-5 inline-block text-sm text-ink underline underline-offset-4"
      >
        Voltar para as dietas
      </Link>
    </Card>
  );
}

function EditorSkeleton() {
  return (
    <div aria-hidden className="space-y-4">
      <Skeleton className="h-4 w-16" />
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-40 w-full rounded-lg" />
      <Skeleton className="h-40 w-full rounded-lg" />
    </div>
  );
}
