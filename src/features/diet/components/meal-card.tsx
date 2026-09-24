"use client";

import {
  Check,
  ChevronDown,
  ChevronsUp,
  ChevronUp,
  Combine,
  Copy,
  GripVertical,
  MoreVertical,
  Pencil,
  Plus,
  Shuffle,
  Trash2,
} from "lucide-react";
import { useState } from "react";

import { cn } from "@/design-system/cn";
import { Button } from "@/design-system/components/button";
import { ConfirmButton } from "@/design-system/components/confirm-button";
import { Dialog } from "@/design-system/components/dialog";
import { Field } from "@/design-system/components/field";
import { Input } from "@/design-system/components/input";
import { ReorderSheet } from "@/design-system/components/reorder-sheet";
import { Select } from "@/design-system/components/select";
import {
  SortableItem,
  SortableList,
} from "@/design-system/components/sortable-list";
import { TimeField } from "@/design-system/components/time-field";
import { useCollapsibleRemove } from "@/design-system/hooks/use-collapsible-remove";
import { useLongPress } from "@/design-system/hooks/use-long-press";
import {
  FOOD_CATEGORIES,
  FOOD_CATEGORY_LABELS,
  type FoodCategory,
} from "@/features/foods";

import { mealMacros } from "../services/diet-macros";
import type { Meal, MealItem } from "../types/diet";
import { InlineText } from "./inline-text";
import { MacroSummary } from "./macro-summary";
import { MealAlternativesDialog } from "./meal-alternatives-dialog";
import { MealItemRow } from "./meal-item-row";
import { Card } from "@/design-system/components/card";

interface Props {
  readonly meal: Meal;
  readonly position: number;
  readonly total: number;
  /**
   * Props for the drag handle, when the card sits inside a sortable list —
   * `undefined` in the Diário since RM01 (roadmap 23/09/2026): dragging
   * there only happens inside the long-press sheet, never in the normal
   * list. `DietEditor` still passes this, unchanged. Cascades to
   * `MealItemRow`'s own drag handle below: a meal without one renders its
   * items the same, plain way (see `itemsDragHandle`).
   */
  readonly dragHandle?:
    | {
        readonly attributes: React.HTMLAttributes<HTMLElement>;
        readonly listeners: Record<string, unknown> | undefined;
        readonly isDragging: boolean;
      }
    | undefined;
  readonly onChange: (
    changes: Partial<Pick<Meal, "name" | "time" | "notes">>,
  ) => void;
  readonly onRemove: () => void;
  readonly onDuplicate: () => void;
  readonly onMove: (offset: number) => void;
  /**
   * "Adicionar alimento" navigates to `/alimentos/selecionar` (17/09/2026)
   * instead of opening `FoodPicker` inline — the parent owns the URL
   * (`returnTo`/`mealId`) because it, not this card, knows which screen and
   * which day it is.
   */
  readonly onAddFoodClick: () => void;
  readonly onItemGramsChange: (itemId: string, grams: number) => void;
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
  /**
   * O botão ao lado do check — devolve a refeição pra lista compacta de
   * "Planejado", desfazendo o que `onOpen`/o check abriram. Só existe
   * quando faz sentido: uma refeição vinda da dieta, ainda não comida.
   * `undefined` em qualquer outro caso (comida, ou montada à mão), a mesma
   * regra de `checkState`/`onToggleChecked` — ver `food-log-screen.tsx`.
   */
  readonly onClose?: (() => void) | undefined;
  /**
   * The "Outras sugestões" button and its sheet only exist when this is
   * given — today only from `DietEditor`. A day already eaten (`FoodLogScreen`)
   * has nothing to suggest: what happened, happened.
   */
  readonly onSaveAlternative?: ((name: string) => void) | undefined;
  readonly onApplyAlternative?: ((alternativeId: string) => void) | undefined;
  readonly onRenameAlternative?:
    | ((alternativeId: string, name: string) => void)
    | undefined;
  readonly onRemoveAlternative?: ((alternativeId: string) => void) | undefined;
  /**
   * RM02 — a food's own detail page, one click away. `undefined` in
   * `DietEditor`: a plan's item has no day to show "what happened" for, so
   * there is nothing this page would say that is not already on the card.
   * Only `FoodLogScreen` gives this, the same "only where it means
   * something" rule `checkState`/`onSaveAlternative` above already follow.
   */
  readonly onOpenItemDetail?: ((itemId: string) => void) | undefined;
  /**
   * RM01 — holding the header opens the day's "reorder refeições" sheet.
   * `undefined` in `DietEditor`, the same as `dragHandle` above — the two
   * are mutually exclusive, never both given for the same card.
   */
  readonly onLongPressReorder?: (() => void) | undefined;
  /**
   * Pedro, 23/09/2026: "minha refeição foi arroz, feijão, carne e purê, mas
   * quero um botão pra transformar ela em 'marmita de carne'... queria que
   * isso virasse um alimento, e eu poder usar em outros dias no diario e
   * ate mesmo adicionar na dieta". Turns every food in the meal into one
   * real catalogue `Food` — same combined macros, reusable everywhere any
   * other food already is, not a one-off row. `undefined` in `DietEditor`,
   * the same "only where it means something" rule as `onOpenItemDetail`
   * above: this is about what actually got eaten, not a plan for what
   * might.
   */
  readonly onConsolidate?:
    | ((name: string, category: FoodCategory) => void)
    | undefined;
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
  onAddFoodClick,
  onItemGramsChange,
  onRemoveItem,
  onReorderItems,
  otherMeals,
  onSendItem,
  checkState,
  onToggleChecked,
  onClose,
  onSaveAlternative,
  onApplyAlternative,
  onRenameAlternative,
  onRemoveAlternative,
  onOpenItemDetail,
  onLongPressReorder,
  onConsolidate,
}: Props) {
  const [showingAlternatives, setShowingAlternatives] = useState(false);
  const [showingActions, setShowingActions] = useState(false);
  const [showingItemReorder, setShowingItemReorder] = useState(false);
  const [showingConsolidate, setShowingConsolidate] = useState(false);
  const [consolidateName, setConsolidateName] = useState("");
  // Mesmo padrão do `EMPTY.category` em `custom-food-form.tsx` — não há
  // categoria "certa" pra um prato misto, só um ponto de partida razoável
  // que a pessoa pode trocar.
  const [consolidateCategory, setConsolidateCategory] =
    useState<FoodCategory>("protein");
  const { isPressing, ...longPress } = useLongPress(
    onLongPressReorder ?? (() => undefined),
    { disabled: onLongPressReorder === undefined },
  );
  // Mesma técnica de `performed-set-row.tsx` ("Concluir série"): a animação
  // é presa ao toque, nunca ao estado — `checkState` sozinho dispararia de
  // novo em toda remontagem do Diário, marcando de volta uma refeição que só
  // foi lida do banco já concluída.
  const [taps, setTaps] = useState(0);
  const macros = mealMacros(meal);

  // O item mais novo entra com --animate-rise — o "Entry Insert" que dá
  // continuidade ao registro, não um efeito por si. Mesma técnica de
  // `GramsField` (`meal-item-row.tsx`): ajustar o estado durante a
  // renderização, comparando contra o último tamanho visto, em vez de um
  // efeito — só dispara quando um item é de fato adicionado, nunca ao
  // reabrir a dieta com os itens que já existiam.
  const [seenItemCount, setSeenItemCount] = useState(meal.items.length);
  const [justAddedId, setJustAddedId] = useState<string | null>(null);
  if (meal.items.length !== seenItemCount) {
    if (meal.items.length > seenItemCount) {
      setJustAddedId(meal.items.at(-1)?.id ?? null);
    }
    setSeenItemCount(meal.items.length);
  }

  const { requestRemove, collapseProps } = useCollapsibleRemove(onRemove);

  /**
   * One food's row, in either mode: `handle` given renders the old drag
   * handle (`DietEditor`), `undefined` renders none and wires the long
   * press that opens `showingItemReorder` instead (Diário, RM01).
   */
  function renderItemRow(
    item: MealItem,
    handle:
      | {
          readonly attributes: React.HTMLAttributes<HTMLElement>;
          readonly listeners: Record<string, unknown> | undefined;
          readonly isDragging: boolean;
        }
      | undefined,
  ) {
    return (
      <MealItemRow
        key={item.id}
        item={item}
        dragHandle={handle}
        onLongPressReorder={
          handle === undefined
            ? () => {
                setShowingItemReorder(true);
              }
            : undefined
        }
        otherMeals={otherMeals}
        onOpenDetail={
          onOpenItemDetail === undefined
            ? undefined
            : () => {
                onOpenItemDetail(item.id);
              }
        }
        onGramsChange={(grams) => {
          onItemGramsChange(item.id, grams);
        }}
        onRemove={() => {
          onRemoveItem(item.id);
        }}
        onSend={(targetMealId, mode) => {
          onSendItem(item.id, targetMealId, mode);
        }}
        justAdded={item.id === justAddedId}
        onEntranceEnd={() => {
          setJustAddedId((current) => (current === item.id ? null : current));
        }}
      />
    );
  }

  return (
    // Delete/Collapse: this wrapper is only the shrinking grid track
    // (`useCollapsibleRemove`) — `Card` itself keeps its own shadow
    // transition, unaffected and unclipped by this one.
    <div
      className="grid transition-[grid-template-rows] duration-(--duration-standard) ease-out"
      {...collapseProps}
    >
      <div className="overflow-hidden">
        <Card
          as="section"
          className={cn(
            "transition-shadow duration-150 ease-out",
            dragHandle?.isDragging === true && "border-accent shadow-modal",
          )}
        >
          {/* Achado real, 23/09/2026: o total da refeição usava o mesmo
              `MacroSummary` (mesma tipografia, mesma cor) que cada alimento
              embaixo dele usa pro próprio total. Sem estar colado no nome,
              "192 kcal 7 Prot..." lia como o primeiro alimento da lista, não
              como a soma da refeição — primeira correção foi só a posição,
              empilhado logo abaixo do nome (e do horário) em vez de solto ao
              lado do ⋮. Não bastou: os dois ainda liam do mesmo peso visual
              lado a lado, então o bloco abaixo também ganhou destaque de
              verdade (`layout="stacked"`, ver o comentário logo ali) — a
              `border-t` que já separa a lista de alimentos faz o resto.

              RM01: holding anywhere on this header (outside the inputs and
              buttons it already carries — `useLongPress` excludes those at
              the source) opens the day's reorder sheet, in the Diário only. */}
          <header
            {...longPress}
            className={cn(
              "flex flex-wrap items-start gap-2",
              isPressing && "select-none rounded-md bg-muted",
            )}
          >
            {/* `undefined` in the Diário (RM01) — see the prop's own doc. */}
            {dragHandle !== undefined && (
              <button
                type="button"
                aria-label={`Reordenar ${meal.name}`}
                {...dragHandle.attributes}
                {...dragHandle.listeners}
                className="-ml-1 flex size-8 shrink-0 cursor-grab touch-none items-center justify-center touch-44 rounded-md text-ink-subtle transition-colors duration-150 ease-out hover:bg-muted hover:text-ink active:cursor-grabbing"
              >
                <GripVertical aria-hidden className="size-4" />
              </button>
            )}

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
                    onClick={() => {
                      setTaps((count) => count + 1);
                      onToggleChecked();
                    }}
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
                      "transition-[background-color,border-color,color,scale] duration-150 ease-out active:scale-90",
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
                      <Check
                        key={taps}
                        aria-hidden
                        className={cn(
                          "size-4",
                          taps > 0 &&
                            checkState !== "unchecked" &&
                            "animate-pop motion-reduce:animate-none",
                        )}
                      />
                    )}
                  </button>
                )}

                {/* Ao lado do check, não atrás do ⋮ (Pedro, 17/09/2026): "pode
                    estar do lado do check, e aí pode deixar apenas o símbolo,
                    não precisa de escrita". Só o ícone — o rótulo acessível
                    continua completo pra quem usa leitor de tela, só não
                    aparece como texto na tela. */}
                {onClose !== undefined && (
                  <button
                    type="button"
                    onClick={onClose}
                    aria-label="Fechar refeição"
                    title="Fechar refeição"
                    className="flex size-8 shrink-0 items-center justify-center touch-44 rounded-md text-ink-subtle transition-colors duration-150 ease-out hover:bg-muted hover:text-ink"
                  >
                    <ChevronsUp aria-hidden className="size-4" />
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

            <button
              type="button"
              onClick={() => {
                setShowingActions(true);
              }}
              aria-label={`Mais ações para ${meal.name}`}
              className="flex size-8 shrink-0 items-center justify-center touch-44 rounded-md text-ink-subtle transition-colors duration-150 ease-out hover:bg-muted hover:text-ink"
            >
              <MoreVertical aria-hidden className="size-4" />
            </button>
          </header>

          {/* Achado real, 17/09/2026: a barra fina colorida (`MealMacroBar`)
              escondia os números atrás de uma cor — Pedro queria ver os
              números mesmo, não "esse graficozinho". De volta ao
              `MacroSummary` de sempre.

              `layout="stacked"`, achado real de 23/09/2026, com print de
              referência do Pedro: o total da refeição precisa ler maior
              que o de cada alimento embaixo dele (`MealItemRow` continua
              em `layout` padrão), as quatro figuras juntas — não só kcal —
              sempre numa linha só, e de verdade centralizadas no card, não
              só no que sobrava ao lado do ⋮.

              **Por que este bloco saiu de dentro do `header`:** até aqui
              ele vivia dentro do `<div className="min-w-0 flex-1">` que
              divide a linha do cabeçalho com o botão ⋮ — e como os dois
              ficam lado a lado na mesma linha flex, essa coluna nunca
              tinha a largura inteira do card, só o que sobrava depois do
              ⋮ (~40px a menos). `grid-cols-4` centralizava certinho dentro
              *dessa* largura, só que essa largura não era a do card —
              resultado, as quatro figuras pareciam empurradas pra
              esquerda, com um vão sobrando à direita do tamanho de
              aproximadamente uma coluna. Como bloco próprio, fora do
              `header`, ele fica livre pra usar a largura inteira do card
              (só o padding do `Card` de fora), e `grid-cols-4` finalmente
              centraliza contra a largura certa. */}
          <div className="mt-2">
            <MacroSummary macros={macros} layout="stacked" />
          </div>

          {/* Atrás do ⋮ em vez de quatro botões soltos no cabeçalho — achado de
              densidade, 17/09/2026: eram quatro alvos de toque (duplicar, mover
              duas direções, excluir) competindo por espaço com o resumo de
              macros em toda refeição da dieta, a maior parte do tempo sem
              nenhum motivo pra estarem visíveis. `Dialog placement="sheet-bottom"`
              reaproveitado, mesmo componente do RPE e das sugestões de refeição —
              nenhuma folha nova. */}
          <Dialog
            open={showingActions}
            title={meal.name}
            onClose={() => {
              setShowingActions(false);
            }}
            placement="sheet-bottom"
          >
            <div className="-my-1 space-y-0.5">
              <MenuRow
                label="Duplicar"
                onClick={() => {
                  onDuplicate();
                  setShowingActions(false);
                }}
              >
                <Copy aria-hidden className="size-4" />
              </MenuRow>
              <MenuRow
                label="Mover para cima"
                disabled={position === 0}
                onClick={() => {
                  onMove(-1);
                  setShowingActions(false);
                }}
              >
                <ChevronUp aria-hidden className="size-4" />
              </MenuRow>
              <MenuRow
                label="Mover para baixo"
                disabled={position === total - 1}
                onClick={() => {
                  onMove(1);
                  setShowingActions(false);
                }}
              >
                <ChevronDown aria-hidden className="size-4" />
              </MenuRow>
              {/* Pedro, 23/09/2026: "transformar ela em 'marmita de
                  carne'" — só aparece com 2+ alimentos (nada a combinar com
                  0 ou 1) e só no Diário (`onConsolidate` indefinido no
                  editor de dieta, ver a doc da prop). */}
              {onConsolidate !== undefined && meal.items.length >= 2 && (
                <MenuRow
                  label="Transformar em 1 alimento"
                  onClick={() => {
                    setShowingActions(false);
                    setConsolidateName("");
                    setShowingConsolidate(true);
                  }}
                >
                  <Combine aria-hidden className="size-4" />
                </MenuRow>
              )}
              <ConfirmButton
                onConfirm={() => {
                  setShowingActions(false);
                  requestRemove();
                }}
                label={`Excluir ${meal.name}`}
                confirmLabel="Excluir?"
                className="h-11 w-full justify-start gap-3 px-3 text-sm text-danger hover:bg-danger/10"
              >
                <Trash2 aria-hidden className="size-4" />
                Excluir
              </ConfirmButton>
            </div>
          </Dialog>

          {meal.items.length > 0 &&
            (dragHandle === undefined ? (
              // RM01: no permanent handle in the Diário — a long press on
              // any row (`renderItemRow` below) opens `itemReorderSheet`
              // instead, scoped to this meal's own items.
              <ul className="mt-2 divide-y divide-line border-t border-line pt-1">
                {meal.items.map((item) => renderItemRow(item, undefined))}
              </ul>
            ) : (
              <SortableList
                ids={meal.items.map((item) => item.id)}
                describe={(id) =>
                  meal.items.find((item) => item.id === id)?.name ?? "alimento"
                }
                onReorder={onReorderItems}
              >
                <ul className="mt-2 divide-y divide-line border-t border-line pt-1">
                  {meal.items.map((item) => (
                    <SortableItem key={item.id} id={item.id}>
                      {(handle) => renderItemRow(item, handle)}
                    </SortableItem>
                  ))}
                </ul>
              </SortableList>
            ))}

          {/* Adicionar alimento e Observações na mesma linha — dividir em duas
              era espaço parado embaixo de toda refeição, a maior parte das
              vezes vazio. `InlineText` já é discreto (borda transparente até
              foco/hover), então não briga por atenção com o botão ao lado. */}
          <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <div className="flex flex-wrap items-center gap-1">
              <button
                type="button"
                onClick={onAddFoodClick}
                className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-ink-muted transition-colors duration-150 ease-out hover:bg-muted hover:text-ink"
              >
                <Plus aria-hidden className="size-4" />
                Adicionar alimento
              </button>

              {/* Só existe vindo da Dieta (ver a doc de `onApplyAlternative`
                  na prop) — pedido real: "vai que ele pede marmita, ele vai
                  ter a marmita de macarrão e de arroz", pra trocar sem editar
                  alimento por alimento toda vez. */}
              {onApplyAlternative !== undefined && (
                <button
                  type="button"
                  onClick={() => {
                    setShowingAlternatives(true);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-ink-muted transition-colors duration-150 ease-out hover:bg-muted hover:text-ink"
                >
                  <Shuffle aria-hidden className="size-4" />
                  Outras sugestões
                  {meal.alternatives !== undefined &&
                    meal.alternatives.length > 0 && (
                      <span className="tabular-nums text-ink-subtle">
                        {meal.alternatives.length}
                      </span>
                    )}
                </button>
              )}
            </div>

            <InlineText
              value={meal.notes}
              onChange={(notes) => {
                onChange({ notes });
              }}
              label={`Observações de ${meal.name}`}
              placeholder="Observações"
              className="min-w-0 flex-1 text-sm text-ink-muted sm:max-w-56 sm:flex-none"
            />
          </div>

          {onApplyAlternative !== undefined && (
            <MealAlternativesDialog
              meal={meal}
              open={showingAlternatives}
              onClose={() => {
                setShowingAlternatives(false);
              }}
              onApply={(alternativeId) => {
                onApplyAlternative(alternativeId);
                setShowingAlternatives(false);
              }}
              onSave={(name) => {
                onSaveAlternative?.(name);
              }}
              onRename={(alternativeId, name) => {
                onRenameAlternative?.(alternativeId, name);
              }}
              onRemove={(alternativeId) => {
                onRemoveAlternative?.(alternativeId);
              }}
            />
          )}

          {/* RM01: only ever reachable in the Diário — a long press on a
              row (`renderItemRow` above) is the only thing that opens
              this, and that path only exists when `dragHandle` itself is
              `undefined`. */}
          <ReorderSheet
            open={showingItemReorder}
            title={`Reordenar alimentos de ${meal.name}`}
            items={meal.items.map((item) => ({
              id: item.id,
              label: item.name,
            }))}
            onReorder={onReorderItems}
            onClose={() => {
              setShowingItemReorder(false);
            }}
          />

          {/* Pedro, 23/09/2026: "transformar ela em 'marmita de carne'...
              queria que isso virasse um alimento, e eu poder usar em
              outros dias no diario e ate mesmo adicionar na dieta". Os
              alimentos atuais desta refeição viram um alimento novo de
              verdade, no catálogo — não um item avulso — com o total
              combinado abaixo (mesmo total que a pessoa já está olhando na
              tela, pra não confirmar às cegas o que vai perder de
              detalhe). */}
          {onConsolidate !== undefined && (
            <Dialog
              open={showingConsolidate}
              title={`Transformar ${meal.name} em 1 alimento`}
              onClose={() => {
                setShowingConsolidate(false);
              }}
              placement="sheet-bottom"
            >
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  if (consolidateName.trim() === "") return;
                  onConsolidate(consolidateName, consolidateCategory);
                  setShowingConsolidate(false);
                }}
                className="space-y-4"
              >
                <p className="text-sm text-ink-muted">
                  {meal.items.map((item) => item.name).join(", ")} viram um
                  alimento novo no catálogo, com o total combinado abaixo —
                  dá pra usar em qualquer outro dia ou dieta depois.
                </p>

                <MacroSummary macros={macros} />

                <div>
                  <Input
                    value={consolidateName}
                    onChange={(event) => {
                      setConsolidateName(event.target.value);
                    }}
                    placeholder="Nome do alimento, ex.: Marmita de carne"
                    aria-label="Nome do novo alimento"
                    autoComplete="off"
                    autoFocus
                  />
                </div>

                <Field label="Categoria" id="consolidate-category">
                  {({ id }) => (
                    <Select
                      id={id}
                      value={consolidateCategory}
                      onChange={(event) => {
                        setConsolidateCategory(
                          event.target.value as FoodCategory,
                        );
                      }}
                    >
                      {FOOD_CATEGORIES.map((category) => (
                        <option key={category} value={category}>
                          {FOOD_CATEGORY_LABELS[category]}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={consolidateName.trim() === ""}
                >
                  <Combine aria-hidden className="size-4" />
                  Transformar
                </Button>
              </form>
            </Dialog>
          )}
        </Card>
      </div>
    </div>
  );
}

/** One row of the actions sheet: an icon, a label, disableable like any of them. */
function MenuRow({
  label,
  onClick,
  disabled = false,
  children,
}: {
  readonly label: string;
  readonly onClick: () => void;
  readonly disabled?: boolean;
  readonly children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex h-11 w-full items-center gap-3 rounded-md px-3 text-sm text-ink transition-colors duration-150 ease-out hover:bg-muted disabled:pointer-events-none disabled:text-ink-subtle disabled:opacity-40"
    >
      {children}
      {label}
    </button>
  );
}
