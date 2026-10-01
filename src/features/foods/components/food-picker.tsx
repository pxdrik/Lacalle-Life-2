"use client";

import { Plus, Star, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { formatDecimal } from "@/core/format/decimal";
import { roundMacros, scaleMacros } from "@/core/domain/macros";
import { cn } from "@/design-system/cn";
import { buttonClasses } from "@/design-system/components/button";
import { Input } from "@/design-system/components/input";
import { useIncrementalReveal } from "@/design-system/hooks/use-incremental-reveal";
import { MACRO_CODING } from "@/design-system/macros";

import { useFoodCatalogue } from "../hooks/use-food-catalogue";
import { useFoodEditor } from "../hooks/use-food-editor";
import { searchFoods } from "../services/search-foods";
import type { Food, FoodCategory, RecentFood } from "../types/food";
import { FOOD_CATEGORIES, FOOD_CATEGORY_LABELS } from "../types/food";
import { CustomFoodForm } from "./custom-food-form";
import { FoodCategoryCards } from "./food-category-cards";

interface Props {
  /**
   * `grams` vem só de um recente (a quantidade da última vez, roadmap 7.2);
   * das outras linhas é `undefined`, e quem recebe usa a porção de referência.
   */
  readonly onPick: (food: Food, grams?: number) => void;
  readonly onCancel: () => void;
  /**
   * O que a pessoa comeu por último, montado pelo diário (`useRecentFoods`).
   * Aparece acima da lista quando a busca está vazia e sem filtro. Opcional:
   * sem ele o seletor é exatamente o de antes.
   */
  readonly recents?: readonly RecentFood[] | undefined;
  /**
   * `true` (default): the inline panel that opens inside a meal card — its
   * own bordered surface, scrolled into view above the bottom nav, results
   * capped to a short internal scrollbox so the meal below stays reachable.
   *
   * `false`: this *is* the page (`/alimentos/selecionar`, 17/09/2026) —
   * there is no meal beside it to keep in view and no surface to draw
   * around content that already fills the screen, so the panel styling and
   * the scroll-into-view effect are skipped, and results flow with the
   * page's own scroll instead of a capped box.
   *
   * Every other prop, and everything below this line, is identical between
   * the two — search, filters, incremental reveal, create-inline. Only the
   * container changes; the content this picks from and how it picks stays
   * one implementation.
   */
  readonly chrome?: boolean;
}

/**
 * Pick a food — inline inside the meal it is adding to (`chrome`, default),
 * or as the page a meal's "Adicionar alimento" navigates to (`chrome=false`).
 *
 * Never a dialog either way: inline, the meal stays visible with no focus
 * trap, scroll lock or escape handling to get subtly wrong; as a page,
 * the same is true of the browser's own back button. One keystroke to
 * filter, one click to pick.
 *
 * Results used to be capped at 8 — "rendering all 216 makes the first
 * keystroke slower for everyone". That comment was right about the risk and
 * wrong about the fix: capping the result *count* also capped what the
 * picker could ever show, which is why category and favourites filters never
 * had anywhere to go here. `useIncrementalReveal` (BUG-011, Sprint 6) caps
 * how many rows *mount*, not how many can exist — the same fix the full
 * catalogues already use — so the list can be complete without the
 * first-keystroke cost coming back.
 */
const RESULT_PAGE_SIZE = 20;

export function FoodPicker({ onPick, onCancel, recents = [], chrome = true }: Props) {
  const { state } = useFoodCatalogue();
  const [text, setText] = useState("");
  const [category, setCategory] = useState<FoodCategory | null>(null);
  const [favoritesOnly, setFavoritesOnly] = useState(false);

  // The same create/edit machinery `/alimentos/novo` uses — `id: null` means
  // creating. Reusing it here, instead of a second write path, is the whole
  // point: this picker never has its own idea of what a valid food is.
  const [creating, setCreating] = useState(false);
  const editor = useFoodEditor(null);

  const results =
    state.status === "ready"
      ? searchFoods(state.foods, { text, category, favoritesOnly })
      : [];
  // Quantos cada cartão de categoria mostraria, com a busca e a estrela como estão.
  const categoryCounts = Object.fromEntries(
    FOOD_CATEGORIES.map((option) => [
      option,
      state.status === "ready" ? searchFoods(state.foods, { text, category: option, favoritesOnly }).length : 0,
    ]),
  ) as Record<FoodCategory, number>;

  // Called unconditionally, above the `creating` branch below — hooks can't
  // follow an early return, even one that never needs this value.
  const { count, hasMore, sentinelRef } = useIncrementalReveal(
    `${text}|${category ?? ""}|${String(favoritesOnly)}`,
    results.length,
    RESULT_PAGE_SIZE,
  );
  const visible = results.slice(0, count);

  // Recentes só com a busca vazia e sem filtro: digitar ou filtrar é procurar
  // outra coisa. E só o que ainda existe no catálogo — um alimento apagado
  // depois de registrado não tem para onde voltar.
  const browsing = text.trim() === "" && category === null && !favoritesOnly;
  const recentRows =
    state.status === "ready" && browsing
      ? recents.flatMap((recent) => {
          const food = state.foods.find((candidate) => candidate.id === recent.foodId);
          return food === undefined ? [] : [{ food, recent }];
        })
      : [];

  // The inline panel opens inside the meal it belongs to — no navigation,
  // no scroll of its own. Found real (17/09/2026): on a meal card already
  // low on the page, the results rendered partly behind the fixed bottom
  // nav, and a tap on the hidden part hit the nav instead of the food.
  // `scroll-mb-(--bottom-nav-h)` below is what makes this scroll leave the
  // bar clear rather than tucking the picker right up against it. As a full
  // page (`chrome=false`) there is nothing to scroll into view — the picker
  // already fills the screen the moment it mounts.
  //
  // Keyed on `state.status`, not run once on mount: the catalogue loads
  // async, so on mount the picker is still just the search bar — a scroll
  // then fits *that*, and the results list (the tall part, the reason this
  // exists) grows in underneath a moment later with nothing re-checking.
  const pickerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (chrome && state.status === "ready") {
      pickerRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [chrome, state.status]);

  if (creating) {
    return (
      <div
        ref={pickerRef}
        className={cn(
          "space-y-3",
          chrome &&
            "scroll-mb-(--bottom-nav-h) rounded-lg border border-line bg-canvas p-3",
        )}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-ink">Criar alimento</h2>
          <button
            type="button"
            onClick={() => {
              setCreating(false);
            }}
            className="text-sm text-ink-muted underline underline-offset-4 hover:text-ink"
          >
            Voltar à busca
          </button>
        </div>

        <CustomFoodForm
          initial={null}
          save={editor.save}
          pending={editor.pending}
          error={editor.error}
          initialName={text}
          onCancel={() => {
            setCreating(false);
          }}
          onSaved={(food) => {
            setCreating(false);
            onPick(food);
          }}
        />
      </div>
    );
  }

  return (
    <div
      ref={pickerRef}
      className={cn(
        "space-y-2",
        chrome &&
          "scroll-mb-(--bottom-nav-h) rounded-lg border border-line bg-canvas p-2",
      )}
    >
      <div className="flex gap-2">
        <Input
          // The picker only opens on an explicit click, so taking focus is
          // what the user just asked for.
          autoFocus
          type="search"
          value={text}
          onChange={(event) => {
            setText(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") onCancel();
          }}
          placeholder="Buscar alimento"
          aria-label="Buscar alimento para adicionar"
          autoComplete="off"
          disabled={state.status !== "ready"}
        />
        {/* Favoritos direto na linha da busca (roadmap 10.5): as categorias
            subiram para os cartões abaixo, e "Filtros" ficaria com a estrela
            sozinha. Mesmo botão da tela Alimentos. */}
        <button
          type="button"
          aria-pressed={favoritesOnly}
          aria-label="Só favoritos"
          onClick={() => {
            setFavoritesOnly(!favoritesOnly);
          }}
          className={cn(
            "shrink-0",
            buttonClasses(favoritesOnly ? "primary" : "secondary"),
            // Quadrado e da altura do campo, como "Fechar busca": aqui nunca
            // há rótulo, então não usa `BESIDE_FIELD` (que o devolve em `sm`).
            "size-(--input-h-beside) px-0",
          )}
        >
          <Star aria-hidden className="size-4" fill={favoritesOnly ? "currentColor" : "none"} />
        </button>
        {/* Escape closes it too, but a touch keyboard has no Escape — leaving
            only that would strand every phone. */}
        <button
          type="button"
          onClick={onCancel}
          aria-label="Fechar busca"
          className="flex size-(--input-h-beside) shrink-0 items-center justify-center rounded-lg border border-line text-ink-subtle transition-colors duration-150 ease-out hover:border-line-strong hover:text-ink"
        >
          <X aria-hidden className="size-4" />
        </button>
      </div>

      {/* As categorias como atalho, entre a busca e os Recentes (roadmap
          10.5): o Pedro escolheu os cartões aqui também, sabendo que empurram
          os Recentes para baixo. */}
      {state.status === "ready" && (
        <FoodCategoryCards
          counts={categoryCounts}
          total={searchFoods(state.foods, { text, category: null, favoritesOnly }).length}
          active={category}
          onSelect={setCategory}
        />
      )}

      {state.status === "error" && (
        <p role="alert" className="px-2 py-3 text-sm text-ink-muted">
          {state.message}
        </p>
      )}

      {state.status === "ready" && (
        <button
          type="button"
          onClick={() => {
            setCreating(true);
          }}
          className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-ink-muted transition-colors duration-150 ease-out hover:bg-muted hover:text-ink"
        >
          <Plus aria-hidden className="size-4" />
          {/* Não é só para quando a busca falha: às vezes o alimento que
              existe não é o que a pessoa quer registrar (marca diferente,
              preparo diferente), e a ação precisa estar à mão o tempo
              todo — não só aparecer depois de "nenhum alimento
              encontrado". */}
          {text.trim() === "" ? "Criar alimento" : `Criar "${text.trim()}"`}
        </button>
      )}

      {recentRows.length > 0 && (
        <section aria-labelledby="food-picker-recents">
          <h3
            id="food-picker-recents"
            className="px-2 pt-2 pb-1 text-xs font-medium tracking-wide text-ink-subtle uppercase"
          >
            Recentes
          </h3>
          <ul>
            {recentRows.map(({ food, recent }) => (
              <li key={`recent-${food.id}`}>
                <PickRow
                  food={food}
                  grams={recent.grams}
                  detail={recent.detail}
                  onClick={() => {
                    onPick(food, recent.grams);
                    setText("");
                  }}
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      {recentRows.length > 0 && results.length > 0 && (
        <h3 className="px-2 pt-3 pb-1 text-xs font-medium tracking-wide text-ink-subtle uppercase">
          Todos os alimentos
        </h3>
      )}

      {state.status === "ready" && results.length === 0 && (
        <p className="px-2 py-3 text-sm text-ink-subtle">
          Nenhum alimento encontrado.
        </p>
      )}

      {results.length > 0 && (
        <ul className={chrome ? "max-h-72 overflow-y-auto" : undefined}>
          {visible.map((food) => {
            const portion = referencePortion(food);

            return (
              <li key={food.id}>
                <PickRow
                  food={food}
                  grams={portion.grams}
                  detail={`${FOOD_CATEGORY_LABELS[food.category]} · ${portion.label}`}
                  onClick={() => {
                    onPick(food);
                    // Cleared so the next food can be typed straight away.
                    // The picker stays open because adding several foods to
                    // one meal is the normal case. Filters survive the pick
                    // on purpose — adding several foods from the same
                    // category is exactly what they are for.
                    setText("");
                  }}
                />
              </li>
            );
          })}

          {hasMore && <li ref={sentinelRef} aria-hidden className="h-px" />}
        </ul>
      )}
    </div>
  );
}

/**
 * Uma linha do seletor: nome, detalhe, e kcal e macros na quantidade dada.
 *
 * Extraída quando os recentes (roadmap 7.2) passaram a precisar da mesma
 * linha com outra quantidade e outro detalhe. A lista normal mostra a porção
 * de referência; um recente mostra a quantidade da última vez.
 *
 * The name used to be a single truncated line, squeezed between the category
 * and the kcal column — unreadable for anything longer than a few letters at a
 * phone width. It wraps now (category moved below it) instead of cutting off;
 * the row is a real button end to end either way.
 *
 * Achado de teste manual real: um número solto de kcal, sem dizer se é por
 * 100 g ou pela porção, obrigava a abrir o alimento pra saber o que ele
 * realmente traz — o mesmo problema que a referência do app Macros resolve
 * mostrando nome, porção, kcal e os três macros juntos numa linha só. Os
 * macros usam a cor que o app já usa em toda outra tela — nunca uma cor nova
 * só pra esta lista.
 */
function PickRow({
  food,
  grams,
  detail,
  onClick,
}: {
  readonly food: Food;
  readonly grams: number;
  readonly detail: string;
  readonly onClick: () => void;
}) {
  const macros = roundMacros(scaleMacros(food.per100g, grams));

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full min-h-11 items-center gap-3 rounded-md px-2 py-2 text-left transition-colors duration-100 ease-out hover:bg-muted"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-sm text-ink">{food.name}</span>
        <span className="mt-0.5 block text-xs text-ink-subtle">{detail}</span>
      </span>
      <span className="shrink-0 text-right text-xs tabular-nums">
        <span className="block text-ink-muted">{formatDecimal(macros.kcal)} kcal</span>
        <span className="mt-0.5 flex items-baseline justify-end gap-1.5">
          {MACRO_CODING.map(({ key, text }) => (
            <span key={key} className={text}>
              {formatDecimal(macros[key], 1)}
            </span>
          ))}
        </span>
      </span>
    </button>
  );
}

/**
 * What the kcal/macro column of a result row is measured against.
 *
 * The medida caseira when the food has one — because that is the quantity
 * someone actually pictures ("1 pão", "1 ovo"), not an abstract 100 g — and
 * 100 g otherwise, since that is what `per100g` already is and no invented
 * number would be more honest than the one the catalogue actually carries.
 */
export function referencePortion(food: Food): { readonly grams: number; readonly label: string } {
  return food.practicalUnit === undefined
    ? { grams: 100, label: `100 ${food.unit}` }
    : { grams: food.practicalUnit.grams, label: food.practicalUnit.label };
}
