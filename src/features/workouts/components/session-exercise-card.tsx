"use client";

import { Plus } from "lucide-react";

import type { PerformedSetChanges } from "../services/edit-session";
import type { SessionExercise } from "../types/session";
import { PerformedSetRow } from "./performed-set-row";

interface Props {
  readonly exercise: SessionExercise;
  readonly nextSetId: string | null;
  readonly onSetChange: (setId: string, changes: PerformedSetChanges) => void;
  readonly onToggleComplete: (setId: string) => void;
  readonly onRemoveSet: (setId: string) => void;
  readonly onAddSet: () => void;
  readonly onNotesChange: (notes: string) => void;
}

export function SessionExerciseCard({
  exercise,
  nextSetId,
  onSetChange,
  onToggleComplete,
  onRemoveSet,
  onAddSet,
  onNotesChange,
}: Props) {
  const done = exercise.sets.filter((set) => set.isCompleted).length;
  const isComplete = done === exercise.sets.length && exercise.sets.length > 0;

  return (
    <section className="rounded-xl border border-line bg-surface p-3 sm:p-4">
      <header className="flex items-baseline justify-between gap-3">
        <h2 className="min-w-0 flex-1 truncate font-medium text-ink">
          {exercise.name}
        </h2>
        <span className="shrink-0 font-mono text-xs tabular-nums text-ink-subtle">
          {done}/{exercise.sets.length}
          {isComplete && <span className="ml-1.5 text-accent">✓</span>}
        </span>
      </header>

      {exercise.restSeconds !== null && (
        <p className="mt-0.5 text-xs text-ink-subtle">
          Descanso de {exercise.restSeconds}s
        </p>
      )}

      <ul className="mt-2">
        {exercise.sets.map((set, index) => (
          <PerformedSetRow
            key={set.id}
            set={set}
            index={index}
            exerciseName={exercise.name}
            isNext={set.id === nextSetId}
            onChange={(changes) => {
              onSetChange(set.id, changes);
            }}
            onToggleComplete={() => {
              onToggleComplete(set.id);
            }}
            onRemove={() => {
              onRemoveSet(set.id);
            }}
          />
        ))}
      </ul>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
        <button
          type="button"
          onClick={onAddSet}
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-ink-muted transition-colors duration-150 ease-out hover:bg-muted hover:text-ink"
        >
          <Plus aria-hidden className="size-4" />
          Série extra
        </button>

        <input
          type="text"
          value={exercise.notes}
          aria-label={`Observações de ${exercise.name}`}
          placeholder="Observações"
          onChange={(event) => {
            onNotesChange(event.target.value);
          }}
          className="min-w-40 flex-1 rounded-md border border-transparent bg-transparent px-1.5 py-1 text-sm text-ink-muted transition-colors duration-150 ease-out placeholder:text-ink-subtle hover:border-line focus:border-line-strong focus:bg-surface"
        />
      </div>
    </section>
  );
}
