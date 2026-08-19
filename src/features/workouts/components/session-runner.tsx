"use client";

import { dayKey } from "@/core/format/day";
import { formatDecimal } from "@/core/format/decimal";
import { cn } from "@/design-system/cn";
import { noticeClasses } from "@/design-system/components/notice";
import { PAGE_SHELL_BLEED } from "@/design-system/components/page-shell";
import { Skeleton } from "@/design-system/components/skeleton";
import { TimeField } from "@/design-system/components/time-field";
import { ArrowLeft, Flag, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/design-system/components/button";
import { DisarmProgress } from "@/design-system/components/disarm-progress";
import { useArmed } from "@/design-system/hooks/use-armed";

import { useExerciseLookup } from "../hooks/use-exercise-lookup";
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
  setSessionStartedAt,
  uncompleteSet,
  updatePerformedSet,
} from "../services/edit-session";
import {
  formatDuration,
  nextIncompleteSet,
  sessionElapsedMs,
  sessionProgress,
  sessionVolumeKg,
  timeOfDay,
} from "../services/session-stats";
import type { Session } from "../types/session";
import {
  ExerciseDetailDialog,
  useExerciseDetail,
} from "./exercise-detail-dialog";
import { RestTimerBar } from "./rest-timer-bar";
import { SessionEditor } from "./session-editor";
import { SessionExerciseCard } from "./session-exercise-card";
import { SessionSummary } from "./session-summary";
import { Card } from "@/design-system/components/card";

export function SessionRunner({ sessionId }: { readonly sessionId: string }) {
  const router = useRouter();
  const { state, saveError, apply, remove } = useSessionRunner(sessionId);
  const history = useSessionHistory();
  const catalogue = useExerciseLookup();
  const detail = useExerciseDetail();
  const timer = useRestTimer();
  const finish = useArmed();
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
    return (
      <Notice title="Não foi possível abrir o treino.">{state.message}</Notice>
    );
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
  const pending = progress.total - progress.completed;
  // Só computado quando precisa aparecer — a mesma preguiça que a chamada
  // embutida no JSX tinha antes de virar uma constante.
  const volume = allDone ? sessionVolumeKg(session) : null;

  return (
    <div className="pb-32">
      <Link
        href="/treinos"
        className="inline-flex items-center gap-1.5 text-sm text-ink-muted transition-colors duration-150 ease-out hover:text-ink"
      >
        <ArrowLeft aria-hidden className="size-4" />
        Sair sem finalizar
      </Link>

      <h1 className="mt-3 text-2xl font-medium tracking-normal">
        {session.name}
      </h1>

      {/* Corrects a phone locked mid-workout: the session stays open and
          "Tempo" below climbs into the hours until someone tells it when the
          workout actually began. Always visible rather than behind an edit
          toggle — the field this app already has for the same fix on a
          finished session (`SessionEditor`'s "Data do treino") is out in the
          open too. */}
      <label className="mt-2 flex items-center gap-2">
        <span className="text-xs text-ink-subtle">Início</span>
        <input
          type="date"
          value={dayKey(new Date(session.startedAt))}
          max={dayKey(new Date(now))}
          aria-label="Dia de início do treino"
          onChange={(event) => {
            const [year, month, date] = event.target.value
              .split("-")
              .map(Number);
            if (year === undefined || month === undefined || date === undefined)
              return;

            const started = new Date(session.startedAt);
            started.setFullYear(year, month - 1, date);
            apply((current) => setSessionStartedAt(current, started.getTime()));
          }}
          className="h-8 rounded-md border border-transparent bg-transparent px-1.5 text-xs tabular-nums text-ink-muted transition-colors duration-150 ease-out hover:border-line focus:border-line-strong focus:bg-surface"
        />
        {/* Own field rather than folded into the date one, and text rather
            than `<input type="time">` — see `TimeField` for why: the native
            picker renders AM/PM on an English-locale OS regardless of
            `lang="pt-BR"`, which is what the auditoria externa de 19/08
            (BUG-003) actually caught. */}
        <TimeField
          value={timeOfDay(session.startedAt)}
          label="Horário de início do treino"
          onChange={(time) => {
            if (time === null) return;
            const [hours, minutes] = time.split(":").map(Number);
            if (hours === undefined || minutes === undefined) return;

            const started = new Date(session.startedAt);
            started.setHours(hours, minutes, 0, 0);
            apply((current) => setSessionStartedAt(current, started.getTime()));
          }}
          className="h-8 rounded-md border border-transparent bg-transparent px-1.5 text-xs text-ink-muted transition-colors duration-150 ease-out hover:border-line focus:border-line-strong focus:bg-surface"
        />
      </label>

      {/* The two numbers worth glancing at mid-set, and nothing else. */}
      <div
        className={cn(
          PAGE_SHELL_BLEED,
          "relative sticky top-0 z-10 mt-4 flex items-center gap-6 border-b border-line bg-canvas/90 py-3 backdrop-blur",
        )}
      >
        <Stat
          label="Tempo"
          value={formatDuration(sessionElapsedMs(session, now))}
        />
        <Stat
          label="Séries"
          value={`${String(progress.completed)}/${String(progress.total)}`}
        />
        <div className="flex-1" />
        {/* Two taps while sets are still open, one when everything is done:
            ending a workout at set 1 of 8 used to be a single accidental tap
            on a button that sits where a thumb rests while scrolling.

            The visible label stays short: measured at 360px the bar leaves
            152px for this button and "Encerrar assim?" takes 129, while
            spelling out the count ("Encerrar com 7 pendentes?") needs about
            180 and pushes the bar sideways. The count is already two
            centimetres to the left in "Séries", so the accessible name carries
            it for anyone who cannot see that stat — and starts with the
            visible text, so voice control still matches what is on screen. */}
        <Button
          size="sm"
          variant={allDone ? "primary" : finish.armed ? "danger" : "secondary"}
          className={
            finish.armed && !allDone ? "relative overflow-hidden" : undefined
          }
          aria-label={
            finish.armed && !allDone
              ? `Encerrar assim? ${String(pending)} ${pending === 1 ? "série ainda pendente" : "séries ainda pendentes"}.`
              : undefined
          }
          onBlur={finish.disarm}
          onClick={() => {
            if (allDone) {
              timer.stop();
              apply(finishSession);
              return;
            }

            finish.confirm(() => {
              timer.stop();
              apply(finishSession);
            });
          }}
        >
          {finish.armed && !allDone ? (
            <>
              Encerrar assim?
              <DisarmProgress />
            </>
          ) : (
            <>
              <Flag aria-hidden className="size-4" />
              Finalizar
            </>
          )}
        </Button>

        {/* The same `9/9` that is already two centimetres to the left, drawn.
            No new data and no new calculation — `sessionProgress` was already
            computed for the stat beside it.

            **Two pixels, on the bar's own bottom edge, and no track behind
            it.** It is a line of travel across the session, not a component:
            the ring is the signature and this must not compete with it. A
            track would make it a widget; without one it reads as the border
            filling in as the workout proceeds. `rounded-full` on the fill so
            the leading edge carries the same round cap the ring does. */}
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-0.5 overflow-hidden"
        >
          <div
            // `scaleX` from the left rather than a percentage width. The width
            // version measured 0px in the browser — a percentage inside an
            // absolutely positioned, `overflow-hidden` strip did not resolve —
            // and the transform is the better tool anyway: it composites
            // instead of laying out, and it is what `--animate-drain` already
            // uses for the confirmation bar.
            style={{
              scale: `${String(progress.total === 0 ? 0 : progress.completed / progress.total)} 1`,
            }}
            className="h-full origin-left rounded-full bg-accent transition-[scale] duration-(--duration-standard) ease-out"
          />
        </div>
      </div>

      {saveError !== null && (
        <p role="alert" className={cn("mt-4", noticeClasses())}>
          {saveError}
        </p>
      )}

      {session.exercises.length === 0 ? (
        <div className="mt-6 rounded-lg border border-dashed border-line px-6 py-14 text-center">
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
              catalogue={catalogue.get(exercise.exerciseId)}
              onOpenDetail={detail.show}
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
                else if (
                  exercise.restSeconds !== null &&
                  exercise.restSeconds > 0
                ) {
                  timer.start(exercise.restSeconds);
                }
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
      )}

      {/* The end of the workout, and the one moment on this screen that is not
          a set: raised so that "finalizar" is not one more box in a column of
          exercise cards. */}
      {allDone && volume !== null && (
        <Card tone="hero" className="mt-6 text-center">
          <p className="text-ink">Todas as séries concluídas.</p>
          <p className="mt-1 text-sm text-ink-subtle">
            {formatDecimal(volume.kg)} kg movidos.
          </p>
          {/* BUG-017 (auditoria externa, 14/08): esta linha é a resposta a
              "'500 kg movidos' com uma série de 52,5 kg fora da conta" — o
              texto exato que a auditoria citou é a frase logo acima. O
              problema nunca foi a fórmula, era o silêncio; isto é o aviso,
              não uma regra de treino nova. Cor + ícone + texto, como todo
              estado do app — nunca só a cor. */}
          {volume.excludedSets > 0 && (
            <p className="mt-2 flex items-center justify-center gap-1.5 text-xs text-warning-text">
              <TriangleAlert aria-hidden className="size-3.5 shrink-0" />
              {volume.excludedSets === 1
                ? "1 série concluída sem repetições registradas não entrou no total."
                : `${String(volume.excludedSets)} séries concluídas sem repetições registradas não entraram no total.`}
            </p>
          )}
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
        </Card>
      )}

      <RestTimerBar timer={timer} />
      <ExerciseDetailDialog control={detail} />
    </div>
  );
}

function Stat({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string;
}) {
  return (
    <div>
      <p className="text-[0.6875rem] tracking-wide text-ink-subtle uppercase">
        {label}
      </p>
      <p className="text-lg tabular-nums text-ink">{value}</p>
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
    <div className="rounded-lg border border-dashed border-line px-6 py-14 text-center">
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
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-14 w-full" />
      <Skeleton className="h-56 w-full rounded-lg" />
      <Skeleton className="h-56 w-full rounded-lg" />
    </div>
  );
}

export type { Session };
