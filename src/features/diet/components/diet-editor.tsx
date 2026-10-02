"use client";

import { cn } from "@/design-system/cn";
import { Button } from "@/design-system/components/button";
import { Card } from "@/design-system/components/card";
import { noticeClasses } from "@/design-system/components/notice";
import { PAGE_SHELL_BLEED } from "@/design-system/components/page-shell";
import { Skeleton } from "@/design-system/components/skeleton";
import { ArrowLeft, CalendarDays, Plus } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  SortableItem,
  SortableList,
} from "@/design-system/components/sortable-list";
import { useNutritionTargets } from "@/features/profile";

import { useApplyPickedFood } from "../hooks/use-apply-picked-food";
import { useDietEditor } from "../hooks/use-diet-editor";
import { dietMacros } from "../services/diet-macros";
import { describeWeekdays } from "../services/diet-schedule";
import {
  addMeal,
  applyMealAlternative,
  copyItemToMeal,
  duplicateMeal,
  moveItemToMeal,
  moveMeal,
  removeItem,
  removeMeal,
  removeMealAlternative,
  renameDiet,
  renameMealAlternative,
  reorderMealItems,
  reorderMeals,
  saveMealAsAlternative,
  setDietWeekdays,
  setItemGrams,
  updateMeal,
} from "../services/edit-diet";
import { MealCard } from "./meal-card";
import { InlineText } from "./inline-text";
import { MacroProgress } from "./macro-progress";
import { MacroSummary } from "./macro-summary";
import { WeekdayPicker } from "./weekday-picker";

/**
 * O editor de dieta. Também edita o plano que a nutricionista monta no Life
 * Pro (01/10/2026): mesmo editor, outro repositório por trás, e por isso os
 * pontos que dependem de onde ele está aberto vêm por prop.
 */
export function DietEditor({
  dietId,
  backHref = "/dietas",
  backLabel = "Dietas",
  editorPath,
  nameLabel = "Nome da dieta",
  showTargets = true,
  showWeekdays = false,
}: {
  readonly dietId: string;
  readonly backHref?: Route;
  readonly backLabel?: string;
  /** Para onde o seletor de alimentos volta. Padrão: `/dietas/<id>`. */
  readonly editorPath?: string;
  readonly nameLabel?: string;
  /**
   * As metas da conta aberta. No Life Pro ficam de fora: seriam as metas da
   * nutricionista, não as do paciente.
   */
  readonly showTargets?: boolean;
  /**
   * Os dias, aqui no editor. Só no Life Pro (Etapa 5e): os dias do plano são
   * da nutricionista e vão com o rascunho. As dietas da pessoa escolhem os
   * dias na lista, onde um dia tira o outro de outra dieta.
   */
  readonly showWeekdays?: boolean;
}) {
  const { state, saveError, hasConflict, apply, reload } = useDietEditor(dietId);
  // `null` whenever no profile is filled in, which is the normal case.
  const ownTargets = useNutritionTargets();
  const targets = showTargets ? ownTargets : null;
  const router = useRouter();
  const [choosingDays, setChoosingDays] = useState(false);
  useApplyPickedFood(apply);

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
        href={backHref}
        className="inline-flex items-center gap-1.5 text-sm text-ink-muted transition-colors duration-150 ease-out hover:text-ink"
      >
        <ArrowLeft aria-hidden className="size-4" />
        {backLabel}
      </Link>

      <InlineText
        value={diet.name}
        onChange={(name) => {
          apply((current) => renameDiet(current, name));
        }}
        label={nameLabel}
        placeholder="Dieta sem nome"
        className="mt-3 w-full text-2xl font-medium tracking-normal"
      />

      {showWeekdays && (
        <>
          <button
            type="button"
            onClick={() => {
              setChoosingDays(true);
            }}
            className="mt-1 -ml-2 flex min-h-11 items-center gap-1.5 rounded-md px-2 text-sm text-ink-muted transition-colors duration-150 ease-out hover:bg-muted hover:text-ink"
          >
            <CalendarDays aria-hidden className="size-4 shrink-0" />
            <span className="sr-only">Dias do plano:</span>
            {describeWeekdays(diet.weekdays)}
          </button>
          <WeekdayPicker
            open={choosingDays}
            dietName={diet.name}
            selected={diet.weekdays}
            description="O Diário do paciente usa este plano nos dias marcados. Num dia que também é de uma dieta dele, ele escolhe qual usar. Mudar os dias entra na próxima versão publicada."
            trainingShortcuts={false}
            onSave={(weekdays) => {
              apply((current) => setDietWeekdays(current, weekdays));
            }}
            onClose={() => {
              setChoosingDays(false);
            }}
          />
        </>
      )}

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
                  onAddFoodClick={() => {
                    const returnTo = encodeURIComponent(editorPath ?? `/dietas/${dietId}`);
                    router.push(
                      `/alimentos/selecionar?returnTo=${returnTo}&mealId=${meal.id}`,
                    );
                  }}
                  onItemGramsChange={(itemId, grams) => {
                    apply((current) =>
                      setItemGrams(current, meal.id, itemId, grams),
                    );
                  }}
                  onRemoveItem={(itemId) => {
                    apply((current) => removeItem(current, meal.id, itemId));
                  }}
                  onSaveAlternative={(name) => {
                    apply((current) =>
                      saveMealAsAlternative(current, meal.id, name),
                    );
                  }}
                  onApplyAlternative={(alternativeId) => {
                    apply((current) =>
                      applyMealAlternative(current, meal.id, alternativeId),
                    );
                  }}
                  onRenameAlternative={(alternativeId, name) => {
                    apply((current) =>
                      renameMealAlternative(
                        current,
                        meal.id,
                        alternativeId,
                        name,
                      ),
                    );
                  }}
                  onRemoveAlternative={(alternativeId) => {
                    apply((current) =>
                      removeMealAlternative(current, meal.id, alternativeId),
                    );
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
        className="mt-3 inline-flex h-(--control-h-lg) w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-line text-sm text-ink-muted transition-colors duration-150 ease-out hover:border-line-strong hover:text-ink"
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
