"use client";

import { Check, X } from "lucide-react";
import { useEffect, useRef } from "react";

import { formatDecimal, parseDecimal } from "@/core/format/decimal";
import { cn } from "@/design-system/cn";

import type { PerformedSetChanges } from "../services/edit-session";
import type { PerformedSet } from "../types/session";
import { RpeSelect } from "./rpe-select";

interface Props {
  readonly set: PerformedSet;
  readonly index: number;
  readonly exerciseName: string;
  /** The next set to do. Highlighted and scrolled to, never focus-stolen. */
  readonly isNext: boolean;
  readonly onChange: (changes: PerformedSetChanges) => void;
  readonly onToggleComplete: () => void;
  readonly onRemove: () => void;
}

const FIELD =
  "h-11 w-full rounded-lg border bg-surface px-2 text-center font-mono text-base tabular-nums transition-colors duration-150 ease-out";

export function PerformedSetRow({
  set,
  index,
  exerciseName,
  isNext,
  onChange,
  onToggleComplete,
  onRemove,
}: Props) {
  const row = useRef<HTMLLIElement>(null);
  const number = index + 1;

  useEffect(() => {
    // Scrolled into view, but never focused. Focusing would open the phone
    // keyboard over the rest timer every time a set is marked — the number is
    // usually already right, and typing is the exception.
    if (isNext) row.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [isNext]);

  return (
    <li
      ref={row}
      className={cn(
        "group flex items-center gap-2 rounded-lg px-1 py-1.5 transition-colors duration-200 ease-out",
        isNext && "bg-muted",
        set.isCompleted && "opacity-60",
      )}
    >
      <span className="w-6 shrink-0 text-center font-mono text-sm tabular-nums text-ink-subtle">
        {number}
      </span>

      {/* What was planned, sitting under the field it refers to — a target you
          have to remember is a target you ignore. */}
      <div className="flex-1">
        <input
          type="text"
          inputMode="numeric"
          value={set.reps === null ? "" : String(set.reps)}
          aria-label={`Repetições da série ${String(number)} de ${exerciseName}`}
          placeholder="—"
          onChange={(event) => {
            onChange({ reps: toWholeNumber(event.target.value) });
          }}
          className={cn(FIELD, set.isCompleted ? "border-line" : "border-line-strong")}
        />
        <Planned value={set.planned?.reps ?? null} suffix="reps" />
      </div>

      <div className="flex-1">
        <input
          type="text"
          inputMode="decimal"
          value={set.weightKg === null ? "" : String(set.weightKg)}
          aria-label={`Peso da série ${String(number)} de ${exerciseName}`}
          placeholder="—"
          onChange={(event) => {
            onChange({ weightKg: parseDecimal(event.target.value) });
          }}
          className={cn(FIELD, set.isCompleted ? "border-line" : "border-line-strong")}
        />
        <Planned value={set.planned?.weightKg ?? null} suffix="kg" />
      </div>

      <div className="w-16 shrink-0">
        <RpeSelect
          value={set.rpe}
          label={`RPE da série ${String(number)} de ${exerciseName}`}
          onChange={(rpe) => {
            onChange({ rpe });
          }}
          className="h-11 w-full"
        />
        <Planned value={set.planned?.rpe ?? null} suffix="RPE" />
      </div>

      {/* 44px, the comfortable one-handed target, and the only large button in
          the row — it is the action repeated dozens of times per workout. */}
      <button
        type="button"
        onClick={onToggleComplete}
        aria-pressed={set.isCompleted}
        aria-label={
          set.isCompleted
            ? `Desmarcar série ${String(number)} de ${exerciseName}`
            : `Concluir série ${String(number)} de ${exerciseName}`
        }
        className={cn(
          "flex size-11 shrink-0 items-center justify-center rounded-lg border",
          "transition-[background-color,border-color,color,scale] duration-150 ease-out",
          // The one bit of tactile feedback in the app, on the one action
          // repeated dozens of times per workout. It has to answer the tap
          // before the state even changes.
          "active:scale-90",
          set.isCompleted
            ? "border-accent bg-accent text-accent-ink"
            : "border-line-strong text-ink-subtle hover:border-accent hover:text-ink",
        )}
      >
        <Check aria-hidden className="size-5" />
      </button>

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

function Planned({
  value,
  suffix,
}: {
  readonly value: number | null;
  readonly suffix: string;
}) {
  return (
    <p className="mt-0.5 h-3 text-center font-mono text-[0.625rem] tabular-nums text-ink-subtle">
      {value === null ? "" : `${formatDecimal(value)} ${suffix}`}
    </p>
  );
}

function toWholeNumber(input: string): number | null {
  const digits = input.replace(/\D/g, "");
  if (digits === "") return null;

  return Math.min(Number(digits), 1000);
}
