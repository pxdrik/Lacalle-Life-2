"use client";

import { ArrowLeft, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { roundMacros, scaleMacros } from "@/core/domain/macros";
import { formatDecimal, parseDecimal } from "@/core/format/decimal";
import { cn } from "@/design-system/cn";
import { Button } from "@/design-system/components/button";
import { ConfirmButton } from "@/design-system/components/confirm-button";
import { noticeClasses } from "@/design-system/components/notice";
import { PageHeader } from "@/design-system/components/page-header";
import { ICONS } from "@/design-system/icons";
import { MACRO_CODING } from "@/design-system/macros";

import { FOOD_CATEGORY_LABELS } from "../types/food";
import type { Food, RecentFood } from "../types/food";
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
 * and "Confirmar refeição" appends `addMealId` and one `addFoodId`/`addGrams`
 * pair per food to that address before navigating back. The screen that
 * reads them is on the other side of a feature boundary this one does not
 * cross.
 *
 * **Vários alimentos por ida, como os exercícios do treino (pedido do
 * Pedro, 02/10/2026).** Confirmar a quantidade não volta mais para o Diário:
 * o alimento entra em "Nesta refeição" e a busca volta, até "Confirmar
 * refeição" levar todos de uma vez. Montar uma refeição é normalmente vários
 * alimentos seguidos, e sair e voltar a cada um era o trabalho reclamado.
 * Voltar com alimentos na lista pede um segundo toque, como o treino pede
 * antes de descartar exercícios marcados.
 */
export function FoodSelectionScreen({
  recents,
}: {
  /** Montado pelo diário e entregue pela página (roadmap 7.2). */
  readonly recents?: readonly RecentFood[] | undefined;
} = {}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mealId = searchParams.get("mealId");
  const returnTo = safeReturnTo(searchParams.get("returnTo"));

  const [picked, setPicked] = useState<{
    readonly food: Food;
    /** Só de um recente: a quantidade da última vez (roadmap 7.2). */
    readonly grams: number | undefined;
  } | null>(null);
  const [added, setAdded] = useState<readonly { readonly key: number; readonly food: Food; readonly grams: number }[]>([]);

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
          title={picked.food.name}
          subtitle={FOOD_CATEGORY_LABELS[picked.food.category]}
          className="mt-4"
        />
        <div className="mt-6">
          <QuantityConfirm
            food={picked.food}
            initialGrams={picked.grams}
            onConfirm={(grams) => {
              setAdded((current) => [...current, { key: (current.at(-1)?.key ?? 0) + 1, food: picked.food, grams }]);
              setPicked(null);
            }}
          />
        </div>
      </>
    );
  }

  const count = added.length;

  return (
    <>
      {count === 0 ? (
        <BackLink onClick={goBack} label="Voltar" />
      ) : (
        <ConfirmButton
          label="Voltar sem adicionar"
          confirmLabel={count === 1 ? "Descartar 1 alimento?" : `Descartar ${String(count)} alimentos?`}
          onConfirm={goBack}
          className="inline-flex min-h-8 items-center gap-1.5 text-sm"
        >
          <ArrowLeft aria-hidden className="size-4" />
          Voltar
        </ConfirmButton>
      )}
      <PageHeader icon={ICONS.foods} title="Adicionar alimento" className="mt-4" />

      {count > 0 && (
        <section aria-labelledby="nesta-refeicao" className="mt-6">
          <h2 id="nesta-refeicao" className="text-xs font-medium tracking-wide text-ink-subtle uppercase">
            Nesta refeição
          </h2>
          <ul className="mt-2 divide-y divide-line rounded-lg border border-line bg-surface">
            {added.map((item) => (
              <li key={item.key} className="flex min-h-11 items-center gap-3 py-1 pr-1 pl-4">
                <span className="min-w-0 flex-1 text-sm break-words text-ink">{item.food.name}</span>
                <span className="shrink-0 text-sm text-ink-muted tabular-nums">
                  {formatDecimal(item.grams)} {item.food.unit}
                </span>
                <button
                  type="button"
                  aria-label={`Tirar ${item.food.name}`}
                  onClick={() => {
                    setAdded((current) => current.filter((other) => other.key !== item.key));
                  }}
                  className="flex size-11 shrink-0 items-center justify-center rounded-md text-ink-subtle transition-colors duration-150 ease-out hover:bg-muted hover:text-ink"
                >
                  <X aria-hidden className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mt-6">
        <FoodPicker
          chrome={false}
          onPick={(food, grams) => {
            setPicked({ food, grams });
          }}
          onCancel={goBack}
          recents={recents}
        />
      </div>

      {/* Fixa acima da navegação de baixo, como a barra dos exercícios
          marcados no treino: a contagem é o retorno de que o alimento entrou
          enquanto a busca continua. Quebra linha onde o botão não cabe ao
          lado da contagem (320px Confortável: 26px de rolagem lateral,
          visto vermelho). */}
      {count > 0 && (
        <div className="sticky bottom-(--bottom-nav-h) z-20 -mx-4 mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-line bg-surface px-4 py-3 sm:mx-0 sm:rounded-lg sm:border">
          <p aria-live="polite" className="text-sm text-ink-muted">
            <span className="text-ink tabular-nums">{count}</span> {count === 1 ? "alimento" : "alimentos"}
          </p>
          <Button
            className="ml-auto"
            onClick={() => {
              router.push(buildReturnUrl(returnTo, mealId, added));
            }}
          >
            Confirmar refeição
          </Button>
        </div>
      )}
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
  initialGrams,
  onConfirm,
}: {
  readonly food: Food;
  /** A quantidade da última vez, quando veio de um recente. */
  readonly initialGrams: number | undefined;
  readonly onConfirm: (grams: number) => void;
}) {
  const initial = referencePortion(food);
  const [draft, setDraft] = useState(() => text(initialGrams ?? initial.grams));
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

/** Um par `addFoodId`/`addGrams` por alimento, na ordem em que entraram. */
function buildReturnUrl(
  returnTo: string,
  mealId: string,
  foods: readonly { readonly food: Food; readonly grams: number }[],
): string {
  const [path, existingQuery] = returnTo.split("?");
  const params = new URLSearchParams(existingQuery ?? "");
  params.set("addMealId", mealId);
  for (const { food, grams } of foods) {
    params.append("addFoodId", food.id);
    params.append("addGrams", String(grams));
  }
  return `${path ?? "/diario"}?${params.toString()}`;
}
