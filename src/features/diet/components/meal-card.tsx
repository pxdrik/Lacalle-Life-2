"use client";

import {
  Check,
  ChevronDown,
  ChevronUp,
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
import { ConfirmButton } from "@/design-system/components/confirm-button";
import { Dialog } from "@/design-system/components/dialog";
import {
  SortableItem,
  SortableList,
} from "@/design-system/components/sortable-list";
import { TimeField } from "@/design-system/components/time-field";

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
  /**
   * "Adicionar alimento" navigates to `/alimentos/selecionar` (17/09/2026)
   * instead of opening `FoodPicker` inline — the parent owns the URL
   * (`returnTo`/`mealId`) because it, not this card, knows which screen and
   * which day it is.
   */
  readonly onAddFoodClick: () => void;
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
  onItemUnitChange,
  onRemoveItem,
  onReorderItems,
  otherMeals,
  onSendItem,
  checkState,
  onToggleChecked,
  onSaveAlternative,
  onApplyAlternative,
  onRenameAlternative,
  onRemoveAlternative,
}: Props) {
  const [showingAlternatives, setShowingAlternatives] = useState(false);
  const [showingActions, setShowingActions] = useState(false);
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

  return (
    <Card
      as="section"
      className={cn(
        "transition-shadow duration-150 ease-out",
        dragHandle.isDragging && "border-accent shadow-modal",
      )}
    >
      {/* Wraps on a phone: name + check on one line, the macro bar and the
          ⋮ trigger (both `shrink-0`) drop to their own line below rather
          than forcing the row past a 390px screen. Lighter risk than it
          used to be — the header carries one compact bar and one button now,
          not four action buttons plus a four-figure macro line — but the
          wrap costs nothing to keep. */}
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

        <div className="flex shrink-0 items-center gap-2 max-sm:order-last max-sm:w-full max-sm:justify-between">
          {/* Achado real, 17/09/2026: a barra fina colorida (`MealMacroBar`)
              escondia os números atrás de uma cor — Pedro queria ver os
              números mesmo, não "esse graficozinho". De volta ao
              `MacroSummary` de sempre, já compacto o bastante pra caber
              aqui ao lado do ⋮. */}
          <MacroSummary macros={macros} />

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
        </div>
      </header>

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
          <ConfirmButton
            onConfirm={() => {
              setShowingActions(false);
              onRemove();
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

      {/* Secundária de propósito: "Gramas"/"Unidade" acima de cada campo
          (`meal-item-row.tsx`) já identificam o número na hora. Isto é só a
          confirmação por extenso, para quem quiser ler.
          Só quando se aplica: um alimento sem medida caseira conhecida
          continua mostrando um campo de grama só, exatamente como antes
          disto existir, e a explicação seria sobre um controle que nem
          está na tela. */}
      {meal.items.some((item) => item.practicalUnit !== undefined) && (
        <p className="mt-2 text-xs text-ink-subtle">
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
          <ul className="mt-2 divide-y divide-line border-t border-line pt-1">
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
                    justAdded={item.id === justAddedId}
                    onEntranceEnd={() => {
                      setJustAddedId((current) =>
                        current === item.id ? null : current,
                      );
                    }}
                  />
                )}
              </SortableItem>
            ))}
          </ul>
        </SortableList>
      )}

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
    </Card>
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
