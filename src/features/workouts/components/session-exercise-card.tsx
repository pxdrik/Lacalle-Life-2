"use client";

import { Plus } from "lucide-react";

import { formatDecimal } from "@/core/format/decimal";

import type { PerformedSetChanges } from "../services/edit-session";
import type { LastPerformance } from "../services/history";
import type { Exercise } from "../types/exercise";
import type { SessionExercise } from "../types/session";
import { ExerciseIdentity } from "./exercise-identity";
import { PerformedSetRow } from "./performed-set-row";
import { Card } from "@/design-system/components/card";

interface Props {
  readonly exercise: SessionExercise;
  /** The catalogue entry behind `exerciseId`, when it could be resolved. */
  readonly catalogue: Exercise | undefined;
  readonly onOpenDetail: (exercise: Exercise) => void;
  readonly nextSetId: string | null;
  /** What was done the last time this exercise was trained, if ever. */
  readonly lastTime: LastPerformance | undefined;
  readonly onSetChange: (setId: string, changes: PerformedSetChanges) => void;
  readonly onToggleComplete: (setId: string) => void;
  readonly onRemoveSet: (setId: string) => void;
  readonly onAddSet: () => void;
  readonly onNotesChange: (notes: string) => void;
}

export function SessionExerciseCard({
  exercise,
  catalogue,
  onOpenDetail,
  nextSetId,
  lastTime,
  onSetChange,
  onToggleComplete,
  onRemoveSet,
  onAddSet,
  onNotesChange,
}: Props) {
  const done = exercise.sets.filter((set) => set.isCompleted).length;
  const isComplete = done === exercise.sets.length && exercise.sets.length > 0;
  // The exercise holding the set someone is about to do — never more than one
  // at a time, because `nextIncompleteSet` in `session-runner.tsx` only ever
  // names one. Sprint 8: the same hero treatment `RoutineList` already gives
  // "rotina em andamento", carried into execution — the card someone is
  // actually standing in front of reads as the answer this screen exists to
  // give, not as one more box in a column of exercise cards.
  const isCurrent = nextSetId !== null;

  return (
    <Card as="section" tone={isCurrent ? "hero" : "default"}>
      {/* Thumbnail-sized and no larger. This card is read standing up between
          sets: a big photo here would push the set rows off the screen, which
          costs more than the photo adds. Tapping it opens the detail. */}
      <header className="flex items-center justify-between gap-3">
        <ExerciseIdentity
          name={exercise.name}
          catalogue={catalogue}
          onOpenDetail={onOpenDetail}
        >
          {exercise.restSeconds === null
            ? null
            : `Descanso de ${String(exercise.restSeconds)}s`}
        </ExerciseIdentity>
        <span className="shrink-0 text-xs tabular-nums text-ink-subtle">
          {done}/{exercise.sets.length}
          {isComplete && <span className="ml-1.5 text-accent-text">✓</span>}
        </span>
      </header>

      {/* The question this app is opened to answer: what did I do last time.
          One compact line, above the sets, so it is read before the first rep
          and not hunted for afterwards. */}
      {lastTime !== undefined && (
        <p className="mt-1 truncate text-xs tabular-nums text-ink-muted">
          <span className="font-sans text-ink-subtle">
            Última vez, {formatShortDate(lastTime.performedAt)}:{" "}
          </span>
          {lastTime.sets.map(describeSet).join(" · ")}
        </p>
      )}

      {/* Same header the routine editor already shows — the column labels
          shouldn't only exist where a set is being planned, not where it's
          being done. */}
      <div
        aria-hidden
        className="mt-3 flex items-center gap-2 border-b border-line pb-1.5 text-[0.6875rem] font-medium tracking-wide text-ink-subtle uppercase"
      >
        <span className="w-6 text-center">#</span>
        <span className="flex-1 text-center">Reps</span>
        <span className="flex-1 text-center">Peso</span>
        <span className="w-16 text-center">RPE</span>
        <span className="w-11 shrink-0" />
        <span className="w-11 shrink-0 sm:w-7" />
      </div>

      <ul className="mt-1">
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
    </Card>
  );
}

const shortDate = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
});

function formatShortDate(timestamp: number): string {
  return shortDate.format(new Date(timestamp));
}

function describeSet(set: {
  reps: number | null;
  weightKg: number | null;
}): string {
  const reps = set.reps ?? "—";
  return set.weightKg === null
    ? `${String(reps)}`
    : `${String(reps)}×${formatDecimal(set.weightKg)}`;
}
