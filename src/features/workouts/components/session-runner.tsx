"use client";

import { ArrowLeft, Flag } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/design-system/components/button";

import { useRestTimer } from "../hooks/use-rest-timer";
import { useSessionHistory } from "../hooks/use-session-history";
import { useSessionRunner } from "../hooks/use-session-runner";
import { useTicker } from "../hooks/use-ticker";
import { lastPerformanceByExercise } from "../services/history";
import {
  addPerformedSet,
  completeSet,
  finishSession,
  removePerformedSet,
  setSessionExerciseNotes,
  uncompleteSet,
  updatePerformedSet,
} from "../services/edit-session";
import {
  formatDuration,
  nextIncompleteSet,
  sessionElapsedMs,
  sessionProgress,
  sessionVolumeKg,
} from "../services/session-stats";
import type { Session } from "../types/session";
import { RestTimerBar } from "./rest-timer-bar";
import { SessionEditor } from "./session-editor";
import { SessionExerciseCard } from "./session-exercise-card";
import { SessionSummary } from "./session-summary";

export function SessionRunner({ sessionId }: { readonly sessionId: string }) {
  const router = useRouter();
  const { state, saveError, apply, remove } = useSessionRunner(sessionId);
  const history = useSessionHistory();
  const timer = useRestTimer();
  const [editing, setEditing] = useState(false);

  const running = state.status === "ready" && state.session.finishedAt === null;
  const now = useTicker(running);

  // Excludes this session, so a workout cannot answer questions about itself.
  const lastTimes =
    state.status === "ready" && history.status === "ready"
      ? lastPerformanceByExercise(
          history.sessions,
          state.session.exercises.map((exercise) => exercise.exerciseId),
          state.session.id,
        )
      : new Map();

  if (state.status === "loading") return <RunnerSkeleton />;

  if (state.status === "missing") {
    return (
      <Notice title="Este treino não existe.">
        Ele pode ter sido excluído, ou o link pode estar errado.
      </Notice>
    );
  }

  if (state.status === "error") {
    return <Notice title="Não foi possível abrir o treino.">{state.message}</Notice>;
  }

  const { session } = state;

  if (session.finishedAt !== null) {
    return editing ? (
      <SessionEditor
        session={session}
        apply={apply}
        onDone={() => {
          setEditing(false);
        }}
      />
    ) : (
      <SessionSummary
        session={session}
        onEdit={() => {
          setEditing(true);
        }}
        onDelete={() => {
          void remove().then((deleted) => {
            if (deleted) router.push("/evolucao");
          });
        }}
      />
    );
  }

  const next = nextIncompleteSet(session);
  const progress = sessionProgress(session);
  const allDone = progress.completed === progress.total && progress.total > 0;

  return (
    <div className="pb-32">
      <Link
        href="/treinos"
        className="inline-flex items-center gap-1.5 text-sm text-ink-muted transition-colors duration-150 ease-out hover:text-ink"
      >
        <ArrowLeft aria-hidden className="size-4" />
        Sair sem finalizar
      </Link>

      <h1 className="mt-3 text-2xl font-semibold tracking-tight">{session.name}</h1>

      {/* The two numbers worth glancing at mid-set, and nothing else. */}
      <div className="sticky top-0 z-10 -mx-6 mt-4 flex items-center gap-6 border-b border-line bg-canvas/90 px-6 py-3 backdrop-blur">
        <Stat label="Tempo" value={formatDuration(sessionElapsedMs(session, now))} />
        <Stat label="Séries" value={`${String(progress.completed)}/${String(progress.total)}`} />
        <div className="flex-1" />
        <Button
          size="sm"
          variant={allDone ? "primary" : "secondary"}
          onClick={() => {
            timer.stop();
            apply(finishSession);
          }}
        >
          <Flag aria-hidden className="size-4" />
          Finalizar
        </Button>
      </div>

      {saveError !== null && (
        <p
          role="alert"
          className="mt-4 rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-ink"
        >
          {saveError}
        </p>
      )}

      {session.exercises.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-line px-6 py-14 text-center">
          <p className="text-ink">Este treino não tem exercícios.</p>
          <p className="mt-1.5 text-sm text-ink-subtle">
            Finalize e adicione exercícios ao treino antes de começar.
          </p>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {session.exercises.map((exercise) => (
            <SessionExerciseCard
              key={exercise.id}
              exercise={exercise}
              nextSetId={next?.exerciseId === exercise.id ? next.setId : null}
              lastTime={lastTimes.get(exercise.exerciseId)}
              onSetChange={(setId, changes) => {
                apply((current) =>
                  updatePerformedSet(current, exercise.id, setId, changes),
                );
              }}
              onToggleComplete={(setId) => {
                const set = exercise.sets.find((item) => item.id === setId);
                const wasCompleted = set?.isCompleted === true;

                apply((current) =>
                  wasCompleted
                    ? uncompleteSet(current, exercise.id, setId)
                    : completeSet(current, exercise.id, setId),
                );

                // Rest starts on completion and stops on an undo, because an
                // undo means the set is not over.
                if (wasCompleted) timer.stop();
                else if (exercise.restSeconds !== null && exercise.restSeconds > 0) {
                  timer.start(exercise.restSeconds);
                }
              }}
              onRemoveSet={(setId) => {
                apply((current) => removePerformedSet(current, exercise.id, setId));
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
      )}

      {allDone && (
        <div className="mt-6 rounded-xl border border-line bg-surface p-5 text-center">
          <p className="text-ink">Todas as séries concluídas.</p>
          <p className="mt-1 text-sm text-ink-subtle">
            {sessionVolumeKg(session).toLocaleString("pt-BR")} kg movidos.
          </p>
          <Button
            size="lg"
            className="mt-4"
            onClick={() => {
              timer.stop();
              apply(finishSession);
            }}
          >
            <Flag aria-hidden className="size-4" />
            Finalizar treino
          </Button>
        </div>
      )}

      <RestTimerBar timer={timer} />
    </div>
  );
}

function Stat({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div>
      <p className="text-[0.6875rem] tracking-wide text-ink-subtle uppercase">
        {label}
      </p>
      <p className="font-mono text-lg tabular-nums text-ink">{value}</p>
    </div>
  );
}

function Notice({
  title,
  children,
}: {
  readonly title: string;
  readonly children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed border-line px-6 py-14 text-center">
      <p className="text-ink">{title}</p>
      <p className="mt-1.5 text-sm text-ink-subtle">{children}</p>
      <Link
        href="/treinos"
        className="mt-5 inline-block text-sm text-ink underline underline-offset-4"
      >
        Voltar para os treinos
      </Link>
    </div>
  );
}

function RunnerSkeleton() {
  return (
    <div aria-hidden className="space-y-4">
      <div className="h-4 w-32 rounded bg-muted" />
      <div className="h-8 w-48 rounded bg-muted" />
      <div className="h-14 w-full rounded bg-muted" />
      <div className="h-56 w-full rounded-xl bg-muted" />
      <div className="h-56 w-full rounded-xl bg-muted" />
    </div>
  );
}

export type { Session };
