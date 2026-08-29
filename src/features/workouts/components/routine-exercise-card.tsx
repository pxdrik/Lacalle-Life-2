"use client";

import {
  ChevronDown,
  ChevronUp,
  Copy,
  GripVertical,
  Plus,
  Trash2,
} from "lucide-react";

import { parseDecimal } from "@/core/format/decimal";
import { cn } from "@/design-system/cn";
import { ConfirmButton } from "@/design-system/components/confirm-button";

import type { ExerciseChanges, SetChanges } from "../services/edit-routine";
import type { Exercise } from "../types/exercise";
import type { RoutineExercise } from "../types/routine";
import { ExerciseIdentity } from "./exercise-identity";
import { PlannedSetRow } from "./planned-set-row";
import { Card } from "@/design-system/components/card";

interface Props {
  readonly exercise: RoutineExercise;
  /** The catalogue entry behind `exerciseId`, when it could be resolved. */
  readonly catalogue: Exercise | undefined;
  readonly onOpenDetail: (exercise: Exercise) => void;
  readonly position: number;
  readonly total: number;
  /** Props for the drag handle, when the card sits inside a sortable list. */
  readonly dragHandle?: {
    readonly attributes: React.HTMLAttributes<HTMLElement>;
    readonly listeners: Record<string, unknown> | undefined;
    readonly isDragging: boolean;
  };
  readonly onChange: (changes: ExerciseChanges) => void;
  readonly onRemove: () => void;
  readonly onDuplicate: () => void;
  readonly onMove: (offset: number) => void;
  readonly onAddSet: () => void;
  readonly onRemoveSet: (setId: string) => void;
  readonly onSetChange: (setId: string, changes: SetChanges) => void;
}

export function RoutineExerciseCard({
  exercise,
  catalogue,
  onOpenDetail,
  position,
  total,
  dragHandle,
  onChange,
  onRemove,
  onDuplicate,
  onMove,
  onAddSet,
  onRemoveSet,
  onSetChange,
}: Props) {
  const isCardio = catalogue?.movementPattern === "cardio";

  return (
    <Card
      as="section"
      className={cn(
        "transition-shadow duration-150 ease-out",
        dragHandle?.isDragging === true && "border-accent shadow-modal",
      )}
    >
      {/* Wraps on a phone. Grip, thumbnail and four action buttons leave the
          name about 3px of a 251px row — measured, not estimated — so "Supino
          Declinado com Barra" arrived as nothing at all on the screen whose
          entire job is choosing which exercise to do. Below `sm` the actions
          take a line of their own and the name gets the first one. */}
      <header className="flex flex-wrap items-start gap-2 sm:flex-nowrap">
        {dragHandle !== undefined && (
          <button
            type="button"
            aria-label={`Reordenar ${exercise.name}`}
            {...dragHandle.attributes}
            {...dragHandle.listeners}
            className="-ml-1 flex size-8 shrink-0 cursor-grab touch-none items-center justify-center touch-44 rounded-md text-ink-subtle transition-colors duration-150 ease-out hover:bg-muted hover:text-ink active:cursor-grabbing"
          >
            <GripVertical aria-hidden className="size-4" />
          </button>
        )}

        <ExerciseIdentity
          name={exercise.name}
          catalogue={catalogue}
          onOpenDetail={onOpenDetail}
        >
          {exercise.sets.length}{" "}
          {exercise.sets.length === 1 ? "série" : "séries"}
        </ExerciseIdentity>

        {/* The arrows stay. Dragging a card with one thumb at the gym is worse
            than tapping an arrow, and a handle alone would make reordering a
            pointer-shaped affordance in a screen used one-handed. */}
        <div className="flex w-full shrink-0 items-center justify-end sm:w-auto">
          <IconButton label={`Duplicar ${exercise.name}`} onClick={onDuplicate}>
            <Copy aria-hidden className="size-4" />
          </IconButton>
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
          <ConfirmButton
            onConfirm={onRemove}
            label={`Remover ${exercise.name}`}
            confirmLabel="Remover?"
            className="h-8 min-w-8"
          >
            <Trash2 aria-hidden className="size-4" />
          </ConfirmButton>
        </div>
      </header>

      <div
        aria-hidden
        className="mt-3 flex items-center gap-2 border-b border-line pb-1.5 text-[0.6875rem] font-medium tracking-wide text-ink-subtle uppercase"
      >
        <span className="w-6 text-center">#</span>
        {isCardio ? (
          <span className="flex-[2] text-center">Duração (min)</span>
        ) : (
          <>
            <span className="flex-1 text-center">Reps</span>
            <span className="flex-1 text-center">Peso</span>
          </>
        )}
        {!isCardio && <span className="w-16 text-center">RPE</span>}
        <span className="w-7" />
      </div>

      <ul className="mt-1">
        {exercise.sets.map((set, index) => (
          <PlannedSetRow
            key={set.id}
            set={set}
            index={index}
            exerciseName={exercise.name}
            isCardio={isCardio}
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
            value={
              exercise.restSeconds === null ? "" : String(exercise.restSeconds)
            }
            aria-label={`Descanso de ${exercise.name} em segundos`}
            placeholder="—"
            onChange={(event) => {
              const seconds = parseDecimal(event.target.value);
              onChange({
                restSeconds:
                  seconds === null
                    ? null
                    : Math.min(Math.max(seconds, 0), 3600),
              });
            }}
            className="w-16 rounded-md border border-line bg-surface px-2 py-1 text-center text-sm tabular-nums hover:border-line-strong"
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
    </Card>
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
        "flex size-8 items-center justify-center touch-44 rounded-md text-ink-subtle transition-colors duration-150 ease-out disabled:opacity-30 " +
        (danger === true
          ? "hover:bg-danger/10 hover:text-danger"
          : "hover:bg-muted hover:text-ink")
      }
    >
      {children}
    </button>
  );
}
