"use client";

import { Check } from "lucide-react";

import { Button } from "@/design-system/components/button";

import { dayKey, isFutureDay } from "@/core/format/day";

import {
  addPerformedSet,
  completeSet,
  moveSessionToDay,
  removePerformedSet,
  renameSession,
  setSessionExerciseNotes,
  uncompleteSet,
  updatePerformedSet,
} from "../services/edit-session";
import { useExerciseLookup } from "../hooks/use-exercise-lookup";
import type { Session } from "../types/session";
import {
  ExerciseDetailDialog,
  useExerciseDetail,
} from "./exercise-detail-dialog";
import { SessionExerciseCard } from "./session-exercise-card";

interface Props {
  readonly session: Session;
  readonly apply: (change: (session: Session) => Session) => void;
  readonly onDone: () => void;
}

/**
 * Correcting a workout after the fact.
 *
 * Deliberately does **not** reopen the session. Reopening would clear
 * `finishedAt`, and finishing again would stamp today — so fixing a typo in
 * last Tuesday's workout would move it to this week. History has to stay where
 * it happened.
 *
 * The exercise cards are the same ones the live runner uses. Editing a set is
 * editing a set, whether it happened thirty seconds ago or last month; the
 * only things that do not apply afterwards are the rest timer and the
 * next-set highlight, and both are simply absent here.
 */
export function SessionEditor({ session, apply, onDone }: Props) {
  const catalogue = useExerciseLookup();
  const detail = useExerciseDetail();

  return (
    <div>
      <p className="text-sm text-ink-muted">Editando treino concluído</p>

      <input
        type="text"
        value={session.name}
        aria-label="Nome do treino"
        placeholder="Treino sem nome"
        onChange={(event) => {
          apply((current) => renameSession(current, event.target.value));
        }}
        className="-mx-1.5 mt-1 w-full rounded-md border border-transparent bg-transparent px-1.5 py-0.5 text-2xl font-semibold tracking-tight transition-colors duration-150 ease-out placeholder:text-ink-subtle hover:border-line focus:border-line-strong focus:bg-surface"
      />

      {/* Correcting the day a workout happened, which the app could not do
          before: it only ever stamped "now", so a Saturday session logged on
          Sunday landed in the wrong week — and volume-per-week and "última
          vez" both read from this. */}
      <label className="mt-4 flex items-center gap-3">
        <span className="text-xs text-ink-subtle">Data do treino</span>
        <input
          type="date"
          value={dayKey(new Date(session.startedAt))}
          max={dayKey(new Date())}
          onChange={(event) => {
            const day = event.target.value;
            if (day === "" || isFutureDay(day)) return;

            apply((current) => moveSessionToDay(current, day));
          }}
          className="h-(--control-h) rounded-lg border border-line bg-surface px-3 tabular-nums text-ink transition-colors duration-150 ease-out hover:border-line-strong"
        />
        <span className="text-xs text-ink-subtle">
          A duração não muda — só o dia.
        </span>
      </label>

      <div className="sticky top-0 z-10 -mx-6 mt-4 flex items-center justify-end border-b border-line bg-canvas/90 px-6 py-3 backdrop-blur">
        <Button size="sm" onClick={onDone}>
          <Check aria-hidden className="size-4" />
          Concluir edição
        </Button>
      </div>

      <div className="mt-4 space-y-3">
        {session.exercises.map((exercise) => (
          <SessionExerciseCard
            key={exercise.id}
            exercise={exercise}
            catalogue={catalogue.get(exercise.exerciseId)}
            onOpenDetail={detail.show}
            nextSetId={null}
            lastTime={undefined}
            onSetChange={(setId, changes) => {
              apply((current) =>
                updatePerformedSet(current, exercise.id, setId, changes),
              );
            }}
            onToggleComplete={(setId) => {
              const set = exercise.sets.find((item) => item.id === setId);
              apply((current) =>
                set?.isCompleted === true
                  ? uncompleteSet(current, exercise.id, setId)
                  : completeSet(current, exercise.id, setId),
              );
            }}
            onRemoveSet={(setId) => {
              apply((current) =>
                removePerformedSet(current, exercise.id, setId),
              );
            }}
            onAddSet={() => {
              apply((current) => addPerformedSet(current, exercise.id));
            }}
            onNotesChange={(notes) => {
              apply((current) =>
                setSessionExerciseNotes(current, exercise.id, notes),
              );
            }}
          />
        ))}
      </div>

      <p className="mt-4 text-xs text-ink-subtle">
        A data e a duração do treino não mudam. Elas registram quando ele
        aconteceu, não quando foi corrigido.
      </p>

      <ExerciseDetailDialog control={detail} />
    </div>
  );
}
