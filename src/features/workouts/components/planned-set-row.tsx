"use client";

import { X } from "lucide-react";

import type { PlannedSet } from "../types/routine";
import type { SetChanges } from "../services/edit-routine";
import { RpeSelect } from "./rpe-select";
import { WeightField } from "./weight-field";

interface Props {
  readonly set: PlannedSet;
  readonly index: number;
  readonly exerciseName: string;
  readonly onChange: (changes: SetChanges) => void;
  readonly onRemove: () => void;
}

const CELL =
  "w-full rounded-md border border-line bg-surface px-2 py-1 text-center font-mono text-sm tabular-nums transition-colors duration-150 ease-out hover:border-line-strong";

export function PlannedSetRow({
  set,
  index,
  exerciseName,
  onChange,
  onRemove,
}: Props) {
  const number = index + 1;

  return (
    <li className="group flex items-center gap-2 py-1">
      <span className="w-6 shrink-0 text-center font-mono text-xs tabular-nums text-ink-subtle">
        {number}
      </span>

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

      <WeightField
        value={set.weightKg}
        label={`Peso da série ${String(number)} de ${exerciseName}`}
        onChange={(weightKg) => {
          onChange({ weightKg });
        }}
        className={`${CELL} flex-1`}
      />

      <RpeSelect
        value={set.rpe}
        label={`RPE alvo da série ${String(number)} de ${exerciseName}`}
        onChange={(rpe) => {
          onChange({ rpe });
        }}
        className="w-16 shrink-0"
      />

      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remover série ${String(number)} de ${exerciseName}`}
        className="flex size-7 shrink-0 items-center justify-center rounded-md text-ink-subtle transition-colors duration-150 ease-out hover:bg-danger/10 hover:text-danger sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
      >
        <X aria-hidden className="size-3.5" />
      </button>
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
