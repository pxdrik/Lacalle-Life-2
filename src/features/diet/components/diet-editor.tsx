"use client";

import { ArrowLeft, Plus } from "lucide-react";
import Link from "next/link";

import type { Food } from "@/features/foods";
import { useNutritionTargets } from "@/features/profile";

import { useDietEditor } from "../hooks/use-diet-editor";
import { createMealItem, DEFAULT_GRAMS } from "../services/create-diet";
import { dietMacros } from "../services/diet-macros";
import {
  addItem,
  addMeal,
  removeItem,
  removeMeal,
  renameDiet,
  setItemGrams,
  updateMeal,
} from "../services/edit-diet";
import { MealCard } from "./meal-card";
import { InlineText } from "./inline-text";
import { MacroProgress } from "./macro-progress";
import { MacroSummary } from "./macro-summary";

export function DietEditor({ dietId }: { readonly dietId: string }) {
  const { state, saveError, apply } = useDietEditor(dietId);
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
    return <Notice title="Não foi possível abrir a dieta.">{state.message}</Notice>;
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
        className="mt-3 w-full text-2xl font-semibold tracking-tight"
      />

      {/* Sticky, because the totals are the reason the screen exists: every
          portion change is a question about them. */}
      <div className="sticky top-0 z-10 -mx-6 mt-4 border-b border-line bg-canvas/90 px-6 py-3 backdrop-blur">
        {targets === null ? (
          <MacroSummary macros={totals} size="lg" />
        ) : (
          <MacroProgress totals={totals} targets={targets} />
        )}
      </div>

      {saveError !== null && (
        <p
          role="alert"
          className="mt-4 rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-ink"
        >
          {saveError}
        </p>
      )}

      <div className="mt-5 space-y-3">
        {diet.meals.map((meal) => (
          <MealCard
            key={meal.id}
            meal={meal}
            onChange={(changes) => {
              apply((current) => updateMeal(current, meal.id, changes));
            }}
            onRemove={() => {
              apply((current) => removeMeal(current, meal.id));
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
              apply((current) => setItemGrams(current, meal.id, itemId, grams));
            }}
            onRemoveItem={(itemId) => {
              apply((current) => removeItem(current, meal.id, itemId));
            }}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={() => {
          apply(addMeal);
        }}
        className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-line py-3.5 text-sm text-ink-muted transition-colors duration-150 ease-out hover:border-line-strong hover:text-ink"
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
    <div className="rounded-xl border border-dashed border-line px-6 py-14 text-center">
      <p className="text-ink">{title}</p>
      <p className="mt-1.5 text-sm text-ink-subtle">{children}</p>
      <Link
        href="/dietas"
        className="mt-5 inline-block text-sm text-ink underline underline-offset-4"
      >
        Voltar para as dietas
      </Link>
    </div>
  );
}

function EditorSkeleton() {
  return (
    <div aria-hidden className="space-y-4">
      <div className="h-4 w-16 rounded bg-muted" />
      <div className="h-8 w-64 rounded bg-muted" />
      <div className="h-10 w-full rounded bg-muted" />
      <div className="h-40 w-full rounded-xl bg-muted" />
      <div className="h-40 w-full rounded-xl bg-muted" />
    </div>
  );
}
