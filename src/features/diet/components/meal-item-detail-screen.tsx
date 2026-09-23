"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

import { dayKey, formatDay } from "@/core/format/day";
import { formatDecimal, parseDecimal } from "@/core/format/decimal";
import { Card } from "@/design-system/components/card";
import { Skeleton } from "@/design-system/components/skeleton";

import { useFoodLogDay } from "../hooks/use-food-log";
import { itemMacros } from "../services/diet-macros";
import {
  updateMealItemDetails,
  type MealItemDetailChanges,
} from "../services/edit-diet";
import { MacroSummary } from "./macro-summary";

/**
 * "What I ate" for one food, on one day — RM02, roadmap 23/09/2026.
 *
 * The record, not the catalogue: `item` is `FoodLog`'s own copy (see
 * `MealItem`'s doc on `per100g`/`practicalUnit`), so what shows here is
 * exactly what was logged, unaffected by the catalogue entry changing or
 * disappearing afterwards — same guarantee the rest of the Diário already
 * gives. Brand and the four optional nutrients are the one thing this page
 * can *write*, not only read: nothing else in the app has anywhere to put
 * them, since the catalogue is generic and rarely knows a specific
 * product's label.
 */
export function MealItemDetailScreen() {
  const searchParams = useSearchParams();
  const requestedDay = searchParams.get("dia");
  const mealId = searchParams.get("mealId");
  const itemId = searchParams.get("itemId");

  const validDay =
    requestedDay !== null && /^\d{4}-\d{2}-\d{2}$/.test(requestedDay);
  const day = validDay ? requestedDay : dayKey(new Date());
  const today = dayKey(new Date());
  const backHref = day === today ? "/diario" : `/diario?dia=${day}`;

  const { state, apply } = useFoodLogDay(day);

  if (state.status === "loading") {
    return (
      <div aria-hidden className="space-y-4">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-24 w-full rounded-lg" />
        <Skeleton className="h-40 w-full rounded-lg" />
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <Notice backHref={backHref} title="Não foi possível abrir este dia.">
        {state.message}
      </Notice>
    );
  }

  const meal =
    mealId === null
      ? undefined
      : state.log.meals.find((candidate) => candidate.id === mealId);
  const item =
    meal === undefined || itemId === null
      ? undefined
      : meal.items.find((candidate) => candidate.id === itemId);

  if (meal === undefined || item === undefined || mealId === null) {
    return (
      <Notice backHref={backHref} title="Este alimento não está mais aqui.">
        Ele pode ter sido removido ou movido para outra refeição desde que
        este link foi aberto.
      </Notice>
    );
  }

  const macros = itemMacros(item);

  const save = (changes: MealItemDetailChanges) => {
    apply((current) =>
      updateMealItemDetails(current, meal.id, item.id, changes),
    );
  };

  return (
    <div>
      <BackLink href={backHref} />

      <h1 className="mt-3 text-2xl font-medium tracking-normal text-ink">
        {item.name}
      </h1>
      <p className="mt-1 text-sm text-ink-subtle">
        {meal.name} · {formatDay(day)} ·{" "}
        {formatDecimal(item.grams)} {item.unit}
      </p>

      <Card className="mt-5">
        <MacroSummary macros={macros} size="lg" />
      </Card>

      <Card className="mt-3 space-y-4">
        <h2 className="text-xs font-medium tracking-wide text-ink-subtle uppercase">
          Detalhes
        </h2>

        <TextField
          label="Marca"
          value={item.brand ?? ""}
          placeholder="Não informado"
          onChange={(brand) => {
            save({ brand: brand === "" ? undefined : brand });
          }}
        />

        {/* Por 100 g/ml, igual ao resto do app (`Macros`/`per100g`) — não o
            valor já escalado pela porção, para bater com a mesma base que
            o rótulo de qualquer embalagem de verdade mostra. */}
        <div className="grid grid-cols-2 gap-3">
          <NutrientField
            label="Gordura saturada"
            unit="g / 100 g"
            value={item.saturatedFatG}
            onChange={(value) => {
              save({ saturatedFatG: value });
            }}
          />
          <NutrientField
            label="Sódio"
            unit="mg / 100 g"
            value={item.sodiumMg}
            onChange={(value) => {
              save({ sodiumMg: value });
            }}
          />
          <NutrientField
            label="Fibras"
            unit="g / 100 g"
            value={item.fiberG}
            onChange={(value) => {
              save({ fiberG: value });
            }}
          />
          <NutrientField
            label="Açúcares"
            unit="g / 100 g"
            value={item.sugarG}
            onChange={(value) => {
              save({ sugarG: value });
            }}
          />
        </div>
      </Card>
    </div>
  );
}

function BackLink({ href }: { readonly href: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 text-sm text-ink-muted transition-colors duration-150 ease-out hover:text-ink"
    >
      <ArrowLeft aria-hidden className="size-4" />
      Diário
    </Link>
  );
}

function Notice({
  backHref,
  title,
  children,
}: {
  readonly backHref: string;
  readonly title: string;
  readonly children: React.ReactNode;
}) {
  return (
    <div>
      <BackLink href={backHref} />
      <div className="mt-6 rounded-lg border border-dashed border-line px-6 py-14 text-center">
        <p className="text-ink">{title}</p>
        <p className="mt-1.5 text-sm text-ink-subtle">{children}</p>
      </div>
    </div>
  );
}

function TextField({
  label,
  value,
  placeholder,
  onChange,
}: {
  readonly label: string;
  readonly value: string;
  readonly placeholder: string;
  readonly onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs text-ink-subtle">{label}</span>
      <input
        type="text"
        defaultValue={value}
        placeholder={placeholder}
        onBlur={(event) => {
          onChange(event.target.value.trim());
        }}
        className="mt-1 h-10 w-full rounded-md border border-line bg-surface px-3 text-sm text-ink transition-colors duration-150 ease-out hover:border-line-strong"
      />
    </label>
  );
}

/**
 * A decimal that can be blank — "não informado", never a silent zero (RM02's
 * own rule). Same technique `GramsField` (`meal-item-row.tsx`) uses to let a
 * comma survive being typed — `draft` holds exactly what was typed until a
 * change from elsewhere replaces it — except an empty draft here resolves to
 * `undefined`, not `0`: a blank nutrient means the person has not looked it
 * up, not that the food has none.
 */
function NutrientField({
  label,
  unit,
  value,
  onChange,
}: {
  readonly label: string;
  readonly unit: string;
  readonly value: number | undefined;
  readonly onChange: (value: number | undefined) => void;
}) {
  const [draft, setDraft] = useState(() => text(value));
  const [seen, setSeen] = useState(value);

  if (seen !== value) {
    setSeen(value);
    if (parseDecimal(draft) !== (value ?? null)) setDraft(text(value));
  }

  return (
    <label className="block">
      <span className="text-xs text-ink-subtle">
        {label} <span className="text-ink-subtle/70">({unit})</span>
      </span>
      <input
        type="text"
        inputMode="decimal"
        value={draft}
        placeholder="Não informado"
        onChange={(event) => {
          const next = event.target.value.replace(/[^\d,.]/g, "");
          setDraft(next);
          onChange(parseDecimal(next) ?? undefined);
        }}
        className="mt-1 h-10 w-full rounded-md border border-line bg-surface px-3 text-right text-sm tabular-nums text-ink transition-colors duration-150 ease-out hover:border-line-strong"
      />
    </label>
  );
}

function text(value: number | undefined): string {
  return value === undefined ? "" : String(value).replace(".", ",");
}
