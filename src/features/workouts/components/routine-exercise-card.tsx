"use client";

import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";

import { parseDecimal } from "@/core/format/decimal";

import type { ExerciseChanges, SetChanges } from "../services/edit-routine";
import type { RoutineExercise } from "../types/routine";
import { PlannedSetRow } from "./planned-set-row";

interface Props {
  readonly exercise: RoutineExercise;
  readonly position: number;
  readonly total: number;
  readonly onChange: (changes: ExerciseChanges) => void;
  readonly onRemove: () => void;
  readonly onMove: (offset: number) => void;
  readonly onAddSet: () => void;
  readonly onRemoveSet: (setId: string) => void;
  readonly onSetChange: (setId: string, changes: SetChanges) => void;
}

export function RoutineExerciseCard({
  exercise,
  position,
  total,
  onChange,
  onRemove,
  onMove,
  onAddSet,
  onRemoveSet,
  onSetChange,
}: Props) {
  return (
    <section className="rounded-xl border border-line bg-surface p-4">
      <header className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-medium text-ink">{exercise.name}</h3>
          <p className="mt-0.5 text-xs text-ink-subtle">
            {exercise.sets.length}{" "}
            {exercise.sets.length === 1 ? "série" : "séries"}
          </p>
        </div>

        {/* Arrows rather than drag: they work with a keyboard, with a screen
            reader and with one thumb, and they cost nothing to build. Drag
            joins them later as an accelerator, not as the only way. */}
        <div className="flex shrink-0 items-center">
          <IconButton
            label={`Mover ${exercise.name} para cima`}
            disabled={position === 0}
            onClick={() => {
              onMove(-1);
            }}
          >
            <ChevronUp aria-hidden className="size-4" />
          </IconButton>
          <IconButton
            label={`Mover ${exercise.name} para baixo`}
            disabled={position === total - 1}
            onClick={() => {
              onMove(1);
            }}
          >
            <ChevronDown aria-hidden className="size-4" />
          </IconButton>
          <IconButton label={`Remover ${exercise.name}`} onClick={onRemove} danger>
            <Trash2 aria-hidden className="size-4" />
          </IconButton>
        </div>
      </header>

      <div
        aria-hidden
        className="mt-3 flex items-center gap-2 border-b border-line pb-1.5 text-[0.6875rem] font-medium tracking-wide text-ink-subtle uppercase"
      >
        <span className="w-6 text-center">#</span>
        <span className="flex-1 text-center">Reps</span>
        <span className="flex-1 text-center">Peso</span>
        <span className="w-16 text-center">RPE</span>
        <span className="w-7" />
      </div>

      <ul className="mt-1">
        {exercise.sets.map((set, index) => (
          <PlannedSetRow
            key={set.id}
            set={set}
            index={index}
            exerciseName={exercise.name}
            onChange={(changes) => {
              onSetChange(set.id, changes);
            }}
            onRemove={() => {
              onRemoveSet(set.id);
            }}
          />
        ))}
      </ul>

      <button
        type="button"
        onClick={onAddSet}
        className="mt-1 inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-ink-muted transition-colors duration-150 ease-out hover:bg-muted hover:text-ink"
      >
        <Plus aria-hidden className="size-4" />
        Adicionar série
      </button>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line pt-3">
        <label className="flex items-center gap-2 text-sm text-ink-muted">
          Descanso
          <input
            type="text"
            inputMode="numeric"
            value={exercise.restSeconds === null ? "" : String(exercise.restSeconds)}
            aria-label={`Descanso de ${exercise.name} em segundos`}
            placeholder="—"
            onChange={(event) => {
              const seconds = parseDecimal(event.target.value);
              onChange({
                restSeconds:
                  seconds === null ? null : Math.min(Math.max(seconds, 0), 3600),
              });
            }}
            className="w-16 rounded-md border border-line bg-surface px-2 py-1 text-center font-mono text-sm tabular-nums hover:border-line-strong"
          />
          <span className="text-xs text-ink-subtle">seg</span>
        </label>

        <input
          type="text"
          value={exercise.notes}
          aria-label={`Observações de ${exercise.name}`}
          placeholder="Observações"
          onChange={(event) => {
            onChange({ notes: event.target.value });
          }}
          className="min-w-40 flex-1 rounded-md border border-transparent bg-transparent px-1.5 py-1 text-sm text-ink-muted transition-colors duration-150 ease-out placeholder:text-ink-subtle hover:border-line focus:border-line-strong focus:bg-surface"
        />
      </div>
    </section>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  danger,
  children,
}: {
  readonly label: string;
  readonly onClick: () => void;
  readonly disabled?: boolean;
  readonly danger?: boolean;
  readonly children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={
        "flex size-8 items-center justify-center rounded-md text-ink-subtle transition-colors duration-150 ease-out disabled:opacity-30 " +
        (danger === true
          ? "hover:bg-danger/10 hover:text-danger"
          : "hover:bg-muted hover:text-ink")
      }
    >
      {children}
    </button>
  );
}
