"use client";

import { X } from "lucide-react";

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

const CELL =
  "h-8 w-full rounded-md border border-line bg-surface px-2 text-center text-sm tabular-nums transition-colors duration-150 ease-out hover:border-line-strong";

export function PlannedSetRow({
  set,
  index,
  exerciseName,
  isCardio,
  onChange,
  onRemove,
}: Props) {
  const number = index + 1;
  const { requestRemove, collapseProps } = useCollapsibleRemove(onRemove);

  return (
    // Delete/Collapse: the li shrinks the grid track it owns
    // (`useCollapsibleRemove`) before the real removal runs, instead of the
    // list cutting straight to one row shorter.
    <li
      className="grid transition-[grid-template-rows] duration-(--duration-standard) ease-out"
      {...collapseProps}
    >
      <div className="group flex items-center gap-2 overflow-hidden py-1">
        <span className="w-6 shrink-0 text-center text-xs tabular-nums text-ink-subtle">
          {number}
        </span>

        {isCardio ? (
          <DurationField
            value={set.durationSeconds}
            label={`Duração da série ${String(number)} de ${exerciseName}, em minutos`}
            onChange={(durationSeconds) => {
              onChange({ durationSeconds });
            }}
            className={`${CELL} flex-[2]`}
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
              className={`${CELL} flex-1`}
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
              className={`${CELL} flex-1`}
            />
          </>
        )}

        {/* RPE reports effort against a rep/weight target — a treadmill has
            neither, so there is nothing here for it to rate. */}
        {!isCardio && (
          // `size-8`, não só `w-16`: sem altura própria o mostrador herdava a
          // altura da linha e achatava — um meio círculo pede espaço igual
          // dos dois lados (Pedro, 17/09/2026: "mais quadradinho e não tão
          // retangular"). `size-8` casa com a altura de `CELL` nesta tela.
          <RpeSelect
            value={set.rpe}
            label={`RPE alvo da série ${String(number)} de ${exerciseName}`}
            onChange={(rpe) => {
              onChange({ rpe });
            }}
            className="size-8 shrink-0"
          />
        )}

        <button
          type="button"
          onClick={requestRemove}
          aria-label={`Remover série ${String(number)} de ${exerciseName}`}
          className="flex size-11 shrink-0 items-center justify-center rounded-md text-ink-subtle transition-colors duration-150 ease-out hover:bg-danger/10 hover:text-danger sm:size-7 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
        >
          <X aria-hidden className="size-3.5" />
        </button>
      </div>
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
