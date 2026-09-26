"use client";

import { useState } from "react";

import { Dialog } from "@/design-system/components/dialog";
import { useCollapsibleRemove } from "@/design-system/hooks/use-collapsible-remove";

import type { PlannedSet } from "../types/routine";
import type { SetChanges } from "../services/edit-routine";
import { DurationField } from "./duration-field";
import { RpeSelect } from "./rpe-select";
import { WeightField } from "./weight-field";

interface Props {
  readonly set: PlannedSet;
  readonly index: number;
  readonly exerciseName: string;
  /** Whether this exercise is measured by time rather than reps × weight. */
  readonly isCardio: boolean;
  readonly onChange: (changes: SetChanges) => void;
  readonly onRemove: () => void;
}

/**
 * Sem `flex-1`: a coluna da grade define a largura (`set-grid`,
 * `globals.css`) e a célula ocupa a coluna inteira.
 *
 * O `w-full` dentro de `flex-1` que estava aqui é exatamente o padrão que
 * `performed-set-row.tsx` mediu renderizando a 21,86px em 17/09/2026, abaixo
 * do próprio padding: a porcentagem resolvia contra uma largura calculada
 * pelo `flex-grow`, num elemento com `zoom` próprio. A linha executada foi
 * corrigida na época e esta ficou com o defeito. Numa coluna de grade não há
 * porcentagem contra largura calculada: a faixa existe antes do conteúdo.
 */
const CELL =
  "h-8 w-full rounded-md border border-line bg-surface px-1.5 text-center text-sm tabular-nums transition-colors duration-150 ease-out hover:border-line-strong";

export function PlannedSetRow({
  set,
  index,
  exerciseName,
  isCardio,
  onChange,
  onRemove,
}: Props) {
  const number = index + 1;
  const [showingActions, setShowingActions] = useState(false);
  const { requestRemove, collapseProps } = useCollapsibleRemove(onRemove);

  return (
    // Delete/Collapse: the li shrinks the grid track it owns
    // (`useCollapsibleRemove`) before the real removal runs, instead of the
    // list cutting straight to one row shorter.
    <li
      className="grid transition-[grid-template-rows] duration-(--duration-standard) ease-out"
      {...collapseProps}
    >
      <div className="overflow-hidden py-1">
        <div className="set-grid items-center">
          {/* Mesmo movimento da linha executada: o número é o gatilho das
              ações da série, e não custa coluna nova porque já era a primeira.
              Manter o X aqui e não lá reabriria a divergência entre planejar e
              executar que esta fase existe para fechar. */}
          <button
            type="button"
            onClick={() => {
              setShowingActions(true);
            }}
            aria-label={`Ações da série ${String(number)} de ${exerciseName}`}
            className="flex h-6 w-full items-center justify-center touch-44 rounded-md text-xs tabular-nums text-ink-subtle transition-colors duration-150 ease-out hover:bg-muted hover:text-ink"
          >
            {number}
          </button>

          {isCardio ? (
            <DurationField
              value={set.durationSeconds}
              label={`Duração da série ${String(number)} de ${exerciseName}, em minutos`}
              onChange={(durationSeconds) => {
                onChange({ durationSeconds });
              }}
              className={CELL}
            />
          ) : (
            // Peso primeiro, Repetição em segundo (17/09/2026, pedido do Pedro)
            // — mesma ordem em `performed-set-row.tsx`, `session-exercise-card.tsx`
            // e `routine-exercise-card.tsx`.
            <>
              <WeightField
                value={set.weightKg}
                label={`Peso da série ${String(number)} de ${exerciseName}`}
                onChange={(weightKg) => {
                  onChange({ weightKg });
                }}
                className={CELL}
              />

              <input
                type="text"
                inputMode="numeric"
                value={set.reps === null ? "" : String(set.reps)}
                aria-label={`Repetições da série ${String(number)} de ${exerciseName}`}
                placeholder="—"
                onChange={(event) => {
                  onChange({ reps: toWholeNumber(event.target.value) });
                }}
                className={CELL}
              />
            </>
          )}

          {/* RPE reports effort against a rep/weight target — a treadmill has
              neither, so there is nothing here for it to rate.

              `size-8` é o **desenho** — sem altura própria o mostrador
              herdava a altura da linha e achatava, e um meio círculo pede
              espaço igual dos dois lados (Pedro, 17/09/2026: "mais
              quadradinho e não tão retangular"). A coluna é de 44px e o
              desenho centraliza nela; `touch-44` põe o alvo de toque em 44px
              sem crescer o desenho, o mesmo acordo que o catálogo de
              exercícios já faz com a estrela de favorito.

              O wrapper que esteve aqui entre 26/09 e a Fase 3 saiu junto com
              a razão errada que ele carregava escrita: `RpeSelect` **não**
              ocupava duas faixas da grade. O `<dialog>` fechado é
              `display: none` e elemento assim não vira item de grade — foi
              medido depois. O que estava errado era o teste, que comparava
              `header.children.length` com `row.children.length`, e
              `.children` conta nó invisível. Hoje o componente devolve um nó
              só, porque a folha sai por portal, e nada disso é necessário. */}
          {!isCardio && (
            <RpeSelect
              value={set.rpe}
              label={`RPE alvo da série ${String(number)} de ${exerciseName}`}
              onChange={(rpe) => {
                onChange({ rpe });
              }}
              className="size-8 touch-44 justify-self-center"
            />
          )}
        </div>
      </div>

      {/* Mesma folha da linha executada, mesmas palavras. */}
      <Dialog
        open={showingActions}
        title={`Série ${String(number)} de ${exerciseName}`}
        onClose={() => {
          setShowingActions(false);
        }}
        placement="sheet-bottom"
      >
        <button
          type="button"
          onClick={() => {
            setShowingActions(false);
            requestRemove();
          }}
          aria-label={`Remover série ${String(number)} de ${exerciseName}`}
          className="flex h-11 w-full items-center rounded-md px-3 text-sm text-danger transition-colors duration-150 ease-out hover:bg-danger/10"
        >
          Remover série
        </button>
      </Dialog>
    </li>
  );
}

/**
 * Digits only. Repetitions are whole and non-negative, so the field refuses
 * nonsense at entry instead of validating it afterwards.
 */
function toWholeNumber(input: string): number | null {
  const digits = input.replace(/\D/g, "");
  if (digits === "") return null;

  return Math.min(Number(digits), 1000);
}
