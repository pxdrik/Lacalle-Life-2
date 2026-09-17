"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { roundMacros, scaleMacros } from "@/core/domain/macros";
import { formatDecimal, parseDecimal } from "@/core/format/decimal";
import { cn } from "@/design-system/cn";
import { Button } from "@/design-system/components/button";
import { noticeClasses } from "@/design-system/components/notice";
import { PageHeader } from "@/design-system/components/page-header";
import { ICONS } from "@/design-system/icons";
import { MACRO_CODING } from "@/design-system/macros";

import { FOOD_CATEGORY_LABELS } from "../types/food";
import type { Food } from "../types/food";
import { FoodPicker, referencePortion } from "./food-picker";

/**
 * `/alimentos/selecionar` — a page, not the inline panel `FoodPicker` used to
 * be everywhere (17/09/2026, Pedro: "como o Macros", a dedicated screen
 * rather than a dropdown swallowing the meal card it opens inside of).
 *
 * The content is still `FoodPicker` — search, filters, create-inline, all of
 * it, `chrome={false}` so it reads as the page instead of a bordered panel
 * floating inside one. The only thing this screen adds is the step Macros
 * has and the old inline flow did not: confirming a quantity before the food
 * actually lands in the meal, instead of adding it at a fixed 100 g and
 * expecting a second trip to the meal row to fix it.
 *
 * Hands off to `useApplyPickedFood` (`features/diet`) through the URL, not a
 * shared store: `returnTo` says where the meal is, `mealId` says which one,
 * and confirming a quantity here appends `addFoodId`/`addMealId`/`addGrams`
 * to that address before navigating back. The screen that reads them is on
 * the other side of a feature boundary this one does not cross.
 */
export function FoodSelectionScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mealId = searchParams.get("mealId");
  const returnTo = safeReturnTo(searchParams.get("returnTo"));

  const [picked, setPicked] = useState<Food | null>(null);

  function goBack() {
    router.push(returnTo);
  }

  if (mealId === null) {
    return (
      <>
        <BackLink onClick={goBack} label="Voltar" />
        <div className={cn("mt-6", noticeClasses())} role="alert">
          <p>Nada para adicionar aqui — volte e tente de novo.</p>
        </div>
      </>
    );
  }

  if (picked !== null) {
    return (
      <>
        <BackLink
          onClick={() => {
            setPicked(null);
          }}
          label="Trocar alimento"
        />
        <PageHeader
          icon={ICONS.foods}
          title={picked.name}
          subtitle={FOOD_CATEGORY_LABELS[picked.category]}
          className="mt-4"
        />
        <div className="mt-6">
          <QuantityConfirm
            food={picked}
            onConfirm={(grams) => {
              router.push(buildReturnUrl(returnTo, picked.id, mealId, grams));
            }}
          />
        </div>
      </>
    );
  }

  return (
    <>
      <BackLink onClick={goBack} label="Voltar" />
      <PageHeader icon={ICONS.foods} title="Adicionar alimento" className="mt-4" />
      <div className="mt-6">
        <FoodPicker
          chrome={false}
          onPick={setPicked}
          onCancel={goBack}
        />
      </div>
    </>
  );
}

function BackLink({
  onClick,
  label,
}: {
  readonly onClick: () => void;
  readonly label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 text-sm text-ink-muted transition-colors duration-150 ease-out hover:text-ink"
    >
      <ArrowLeft aria-hidden className="size-4" />
      {label}
    </button>
  );
}

function QuantityConfirm({
  food,
  onConfirm,
}: {
  readonly food: Food;
  readonly onConfirm: (grams: number) => void;
}) {
  const initial = referencePortion(food);
  const [draft, setDraft] = useState(() => text(initial.grams));
  const grams = parseDecimal(draft) ?? 0;
  const macros = roundMacros(scaleMacros(food.per100g, grams));
  const unitLabel = food.unit === "ml" ? "Mililitros" : "Gramas";

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (grams > 0) onConfirm(grams);
      }}
      className="space-y-6"
    >
      <div>
        <label
          htmlFor="quantidade-alimento"
          className="text-xs font-medium tracking-wide text-ink-subtle uppercase"
        >
          {unitLabel}
        </label>
        <input
          id="quantidade-alimento"
          type="text"
          inputMode="decimal"
          autoFocus
          value={draft}
          onFocus={(event) => {
            event.target.select();
          }}
          onChange={(event) => {
            setDraft(readGrams(event.target.value));
          }}
          placeholder="0"
          className="mt-1 h-14 w-full rounded-lg border border-line-strong bg-surface px-4 text-2xl tabular-nums transition-colors duration-150 ease-out focus:border-accent"
        />
        {food.practicalUnit !== undefined && (
          <p className="mt-1.5 text-xs text-ink-subtle">
            Referência: {initial.label} ({formatDecimal(initial.grams)}{" "}
            {food.unit}). A gramatura ajusta depois, na própria refeição.
          </p>
        )}
      </div>

      <dl className="flex flex-wrap items-baseline gap-x-5 gap-y-1 tabular-nums">
        <div className="flex items-baseline gap-1">
          <dd className="text-xl font-medium text-ink">
            {formatDecimal(macros.kcal)}
          </dd>
          <dt className="text-xs text-ink-subtle">kcal</dt>
        </div>
        {MACRO_CODING.map(({ key, short, text: textClass }) => (
          <div key={key} className="flex items-baseline gap-1">
            <dd className={cn("text-xl font-medium", textClass)}>
              {formatDecimal(macros[key])}
            </dd>
            <dt className="text-xs text-ink-subtle">{short}</dt>
          </div>
        ))}
      </dl>

      <Button type="submit" size="lg" disabled={grams <= 0} className="w-full">
        Adicionar à refeição
      </Button>
    </form>
  );
}

/** Same technique as `GramsField`/`meal-item-row.tsx`, simplified: nothing
 * external ever rewrites this field once the screen mounts, so there is no
 * prop-driven value to reconcile the draft against — only what was typed. */
function readGrams(input: string): string {
  const kept = input.replace(/[^\d,.]/g, "");
  const [whole = "", ...rest] = kept.split(/[.,]/);
  return rest.length === 0 ? whole : `${whole},${rest.join("")}`;
}

function text(grams: number): string {
  return grams === 0 ? "" : String(grams).replace(".", ",");
}

/** Never a full URL and never `//host/evil` — only ever a path this app owns. */
function safeReturnTo(value: string | null): string {
  if (value === null || !value.startsWith("/") || value.startsWith("//")) {
    return "/diario";
  }
  return value;
}

function buildReturnUrl(
  returnTo: string,
  foodId: string,
  mealId: string,
  grams: number,
): string {
  const [path, existingQuery] = returnTo.split("?");
  const params = new URLSearchParams(existingQuery ?? "");
  params.set("addFoodId", foodId);
  params.set("addMealId", mealId);
  params.set("addGrams", String(grams));
  return `${path ?? "/diario"}?${params.toString()}`;
}
