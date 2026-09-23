"use client";

import { GripVertical, MoreVertical } from "lucide-react";
import { useState } from "react";

import { formatDecimal, parseDecimal } from "@/core/format/decimal";
import { cn } from "@/design-system/cn";
import { ConfirmButton } from "@/design-system/components/confirm-button";
import { Dialog } from "@/design-system/components/dialog";
import { useCollapsibleRemove } from "@/design-system/hooks/use-collapsible-remove";

import { itemMacros } from "../services/diet-macros";
import type { MealItem } from "../types/diet";
import { MacroSummary } from "./macro-summary";

interface Props {
  readonly item: MealItem;
  readonly dragHandle: {
    readonly attributes: React.HTMLAttributes<HTMLElement>;
    readonly listeners: Record<string, unknown> | undefined;
    readonly isDragging: boolean;
  };
  readonly otherMeals: readonly {
    readonly id: string;
    readonly name: string;
  }[];
  readonly onGramsChange: (grams: number) => void;
  readonly onRemove: () => void;
  readonly onSend: (targetMealId: string, mode: "copy" | "move") => void;
  /** RM02 — the food's own detail page. `undefined` outside the Diário; see `MealCard.onOpenItemDetail`. */
  readonly onOpenDetail?: (() => void) | undefined;
  /**
   * True for exactly one render: o item que acabou de ser adicionado à
   * refeição. Nunca derivado da lista em si — presa à ação de adicionar em
   * `meal-card.tsx`, mesma regra do card recém-adicionado da rotina de
   * treino, para não repetir a entrada ao só reabrir a dieta.
   */
  readonly justAdded?: boolean | undefined;
  /** Limpa `justAdded` quando a entrada realmente terminou de tocar. */
  readonly onEntranceEnd?: (() => void) | undefined;
}

/**
 * One food inside a meal, two lines — name and its actions, then the
 * quantity and its macros.
 *
 * Grams are a live input rather than something behind an edit affordance —
 * adjusting a portion is the single most repeated action in building a diet,
 * and the macros beside it move as you type.
 *
 * **Rewritten 17/09/2026 (Pedro, comparando com o Macros): "a distribuição
 * dos macros tá muito ruim, ocupa muito espaço" e "o X de apagar também
 * faz o card crescer."** A linha antiga quebrava em até três — nome,
 * gramas/unidade, macros+mover+remover — porque sete controles não cabem
 * em ~310px de card num telefone, e o botão de remover sempre visível
 * (`sm:opacity-0` só existia a partir do breakpoint que o celular nunca
 * atinge) empurrava tudo pra uma quarta linha sozinho. Duas linhas fixas
 * agora, nunca três: nome + ⋮ em cima, quantidade + macros embaixo. "Mover
 * para" e "Remover" saíram do fluxo inteiramente, atrás do ⋮ — a mesma
 * ideia do kebab do cabeçalho da refeição (`meal-card.tsx`), agora por
 * alimento.
 *
 * **Kcal juntou o grupo dos macros (RM02, 23/09/2026).** Vivia sozinha na
 * linha do nome, separada de P/C/G na linha de baixo — exatamente a queixa
 * do roadmap ("kcal isolada... macros numa linha inferior"). Agora as
 * quatro leem como um bloco só, via `MacroSummary` (o mesmo componente que
 * já soma isso no cabeçalho da refeição), que embrulha (`flex-wrap`)
 * sozinho se não couber — sem repetir o estouro horizontal que motivou a
 * reescrita de 17/09/2026 acima.
 *
 * **Também 17/09/2026:** o toggle g/ml e o campo de "quantas medidas" saíram
 * — Pedro: alimentos já vêm "definidos" como grama ou mililitro (o próprio
 * catálogo diz, `Food.unit`), e a porção de referência é só texto, nunca um
 * controle: "não precisa de botar adicionar 1 porção", a pessoa só ajusta a
 * gramatura. `GramsField` continua sendo o único campo editável.
 */
export function MealItemRow({
  item,
  dragHandle,
  otherMeals,
  onOpenDetail,
  onGramsChange,
  onRemove,
  onSend,
  justAdded = false,
  onEntranceEnd,
}: Props) {
  const macros = itemMacros(item);
  const [showingActions, setShowingActions] = useState(false);
  const { requestRemove, collapseProps } = useCollapsibleRemove(onRemove);

  return (
    // Delete/Collapse: the li is only the shrinking grid track
    // (`useCollapsibleRemove`) — the drag/entrance styling below lives on
    // the div underneath, unclipped by the collapse's own transition.
    <li
      className="grid transition-[grid-template-rows] duration-(--duration-standard) ease-out"
      {...collapseProps}
    >
      <div
        onAnimationEnd={justAdded ? onEntranceEnd : undefined}
        className={cn(
          "flex items-start gap-2 overflow-hidden py-1.5",
          dragHandle.isDragging && "rounded-sm bg-muted",
          justAdded && "animate-rise motion-reduce:animate-none",
        )}
      >
        {/* Only within a meal, and only by dragging: the order of foods inside a
            meal is cosmetic, and two arrow buttons per row would cost more than
            the reordering is worth. The keyboard sensor still covers it. */}
        <button
          type="button"
          aria-label={`Reordenar ${item.name}`}
          {...dragHandle.attributes}
          {...dragHandle.listeners}
          className="mt-0.5 flex size-6 shrink-0 cursor-grab touch-none items-center justify-center touch-44 rounded-md text-ink-subtle/60 transition-colors duration-150 ease-out hover:text-ink active:cursor-grabbing"
        >
          <GripVertical aria-hidden className="size-3.5" />
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            {onOpenDetail === undefined ? (
              <span className="min-w-0 flex-1 truncate text-sm text-ink">
                {item.name}
              </span>
            ) : (
              // Só o nome, não a linha inteira — o campo de gramas e o ⋮
              // continuam clicáveis pelo que já eram, sem competir com isto.
              <button
                type="button"
                onClick={onOpenDetail}
                className="min-w-0 flex-1 truncate text-left text-sm text-ink underline-offset-2 hover:underline"
              >
                {item.name}
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setShowingActions(true);
              }}
              aria-label={`Mais ações para ${item.name}`}
              className="-my-1 -me-1 flex size-7 shrink-0 items-center justify-center touch-44 rounded-md text-ink-subtle transition-colors duration-150 ease-out hover:bg-muted hover:text-ink"
            >
              <MoreVertical aria-hidden className="size-3.5" />
            </button>
          </div>

          <div className="mt-1 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <div className="flex items-center gap-1.5">
              <GramsField
                grams={item.grams}
                label={`Quantidade de ${item.name}`}
                onChange={onGramsChange}
              />
              {/* Nunca um controle — o alimento já diz se é grama ou mililitro
                  (`Food.unit`), e a gramatura é a única coisa editável aqui. */}
              <span aria-hidden className="text-xs text-ink-subtle">
                {item.unit}
              </span>

              {/* Referência, não um controle (Pedro, 17/09/2026: "não precisa
                  de botar adicionar 1 porção") — só aparece quando o alimento
                  tem uma medida caseira confiável (TBCA/TACO/USDA FBG). */}
              {item.practicalUnit && (
                <span className="text-xs text-ink-subtle">
                  {item.practicalUnit.label} ={" "}
                  {formatDecimal(item.practicalUnit.grams)} {item.unit}
                </span>
              )}
            </div>

            <MacroSummary macros={macros} />
          </div>
        </div>

        <Dialog
          open={showingActions}
          title={item.name}
          onClose={() => {
            setShowingActions(false);
          }}
          placement="sheet-bottom"
        >
          <div className="-my-1 space-y-0.5">
            {otherMeals.length > 0 && (
              <>
                <p className="px-3 pt-1 text-xs font-medium tracking-wide text-ink-subtle uppercase">
                  Mover para
                </p>
                {otherMeals.map((meal) => (
                  <ItemMenuRow
                    key={`move:${meal.id}`}
                    onClick={() => {
                      onSend(meal.id, "move");
                      setShowingActions(false);
                    }}
                  >
                    {meal.name}
                  </ItemMenuRow>
                ))}

                <p className="px-3 pt-2 text-xs font-medium tracking-wide text-ink-subtle uppercase">
                  Copiar para
                </p>
                {otherMeals.map((meal) => (
                  <ItemMenuRow
                    key={`copy:${meal.id}`}
                    onClick={() => {
                      onSend(meal.id, "copy");
                      setShowingActions(false);
                    }}
                  >
                    {meal.name}
                  </ItemMenuRow>
                ))}
              </>
            )}

            <ConfirmButton
              onConfirm={() => {
                setShowingActions(false);
                requestRemove();
              }}
              label={`Remover ${item.name}`}
              confirmLabel="Remover?"
              className="mt-1 h-11 w-full justify-start px-3 text-sm text-danger hover:bg-danger/10"
            >
              Remover
            </ConfirmButton>
          </div>
        </Dialog>
      </div>
    </li>
  );
}

function ItemMenuRow({
  onClick,
  children,
}: {
  readonly onClick: () => void;
  readonly children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-11 w-full items-center rounded-md px-3 text-sm text-ink transition-colors duration-150 ease-out hover:bg-muted"
    >
      {children}
    </button>
  );
}

/**
 * Guards against a pasted number so long it stops being a number.
 *
 * Exported so the backup importer can reject the same absurd quantities the
 * form itself would never let through — one bound, not two that could drift.
 */
export const MAX_GRAMS = 100_000;

/**
 * A portion you can actually type.
 *
 * The field used to strip every non-digit — `input.replace(/\D/g, "")` — which
 * kept it non-negative and, in the same stroke, deleted the decimal separator.
 * **"12,5" was stored as 125**: ten times the portion, on the most repeated
 * action the app has, propagated to the meal total, the day total, the ring
 * and the comparison against the target. Nothing looked wrong, because 125 is
 * a perfectly ordinary number of grams.
 *
 * Parsing alone does not fix it. With the value coming straight back from the
 * stored number, typing "12," parses to 12, re-renders as "12", and the
 * separator is gone before the next digit lands — which is the same failure
 * again by a different route. So the text being typed is held apart from the
 * number it means.
 *
 * **This is the second copy of that technique.** `WeightField` in the workout
 * feature exists for the identical bug — tapping 6·2·,·5 recorded 625 kg — and
 * sharing the two means lifting a workouts component into the design system,
 * which is a refactor this change is not allowed to make. Recorded here rather
 * than left to be discovered.
 */
function GramsField({
  grams,
  label,
  onChange,
}: {
  readonly grams: number;
  readonly label: string;
  readonly onChange: (grams: number) => void;
}) {
  const [draft, setDraft] = useState(() => text(grams));
  const [seen, setSeen] = useState(grams);

  // Adjusting state during render — React's documented alternative to an
  // effect. The guard is what lets a comma survive: after typing "12,5" the
  // value comes back as 12.5, which the draft already means, so the text is
  // left exactly as typed. A change from elsewhere replaces it.
  if (seen !== grams) {
    setSeen(grams);
    if (parseDecimal(draft) !== grams) setDraft(text(grams));
  }

  return (
    <input
      type="text"
      // `decimal` and not `numeric`: on a phone this is the difference between
      // a keypad that offers a comma and one that does not.
      inputMode="decimal"
      value={draft}
      aria-label={label}
      placeholder="0"
      onFocus={(event) => {
        event.target.select();
      }}
      onChange={(event) => {
        const next = readGrams(event.target.value);
        setDraft(next.text);
        onChange(next.grams);
      }}
      className="h-8 w-14 rounded-md border border-line bg-surface px-2 text-right text-sm tabular-nums transition-colors duration-150 ease-out hover:border-line-strong"
    />
  );
}

/**
 * What may be typed into a portion: digits and one separator, nothing else.
 *
 * **Refusing at entry is the old behaviour and it was right** — a portion is a
 * physical quantity and a minus sign has no meaning in it. What was wrong was
 * the separator being thrown out with the sign.
 *
 * Returns the text as well as the number, because the two must not disagree:
 * clamping the value while leaving the field showing what was typed is the
 * screen saying one thing and the store holding another.
 */
function readGrams(input: string): {
  readonly text: string;
  readonly grams: number;
} {
  const kept = input.replace(/[^\d,.]/g, "");
  const [whole = "", ...rest] = kept.split(/[.,]/);
  const text = rest.length === 0 ? whole : `${whole},${rest.join("")}`;

  const value = parseDecimal(text);
  // A lone separator, or nothing: no number yet, and the draft keeps what was
  // typed so the next keystroke has something to land on.
  if (value === null) return { text, grams: 0 };

  if (value > MAX_GRAMS) return { text: String(MAX_GRAMS), grams: MAX_GRAMS };

  return { text, grams: value };
}

/**
 * A comma, like everywhere else in the app — and written by hand rather than
 * with `formatDecimal`, which also groups thousands: "1.000" would come back
 * through `parseDecimal` as 1.
 *
 * Zero shows the placeholder instead of a digit, which is what the field did
 * before and is right: a portion nobody has set yet is blank, not `0 g`.
 */
function text(grams: number): string {
  return grams === 0 ? "" : String(grams).replace(".", ",");
}
