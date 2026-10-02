"use client";

import { Play, Undo2 } from "lucide-react";
import Link from "next/link";

import { weekdayOf } from "@/core/domain/weekday";
import { dayKey } from "@/core/format/day";
import { formatDecimal } from "@/core/format/decimal";
import { Button, buttonClasses } from "@/design-system/components/button";
import { Card } from "@/design-system/components/card";
import { Section } from "@/design-system/components/section";
import { Skeleton } from "@/design-system/components/skeleton";
import { ICONS } from "@/design-system/icons";

import { usePrescribedRoutines } from "../hooks/use-prescribed-routines";
import { useRestDay, type RestDayControl } from "../hooks/use-rest-day";
import { useSessionHistory } from "../hooks/use-session-history";
import { useStartRoutine } from "../hooks/use-start-routine";
import {
  describeRoutineSize,
  prescribedAsRoutine,
  routinesForWeekday,
  trainerScheduleLine,
} from "../services/prescribed-routine";
import {
  formatDuration,
  sessionDurationMs,
  sessionVolumeKg,
} from "../services/session-stats";
import type { PrescribedRoutine } from "../types/prescribed-routine";
import type { Session } from "../types/session";
import { InProgressBanner } from "./in-progress-banner";

/**
 * Whether today's training happened, and what it was.
 *
 * The other half of the question the home screen answers. It owns the whole
 * workout slot rather than sitting beside the "resume" banner: showing
 * "nenhum treino hoje" underneath a workout that is running right now would be
 * the screen contradicting itself.
 *
 * **Two different registers for two different facts.** A session in progress
 * keeps the hero-adjacent treatment `InProgressBanner` already had — the one
 * thing on the screen that is happening *right now* earns it, via
 * `cardSurface("hero")`. Everything else (finished today, or nothing yet)
 * gets the plain grey `default` surface instead — never no surface at all,
 * so the block reads as a peer of `TodayMeals` beside it whether or not
 * anything is running.
 */
export function TodayWorkout({ day }: { readonly day: string }) {
  const state = useSessionHistory();
  const rest = useRestDay(day);
  const prescribed = usePrescribedRoutines();

  if (state.status === "loading" || rest.state.status === "loading" || prescribed.status === "loading") {
    return <Skeleton className="h-40 w-full rounded-lg" />;
  }

  // Silent on failure. The workout half of the day is worth showing when it
  // can be read and not worth an alarm when it cannot — the diary above it is
  // still useful, and `/treinos` will report the same error properly.
  if (state.status === "error") return null;

  if (state.inProgress !== undefined) return <InProgressBanner />;

  const today = state.sessions.filter(
    (session) =>
      session.finishedAt !== null &&
      dayKey(new Date(session.startedAt)) === day,
  );

  const nothingYet = today.length === 0;
  // Meio-dia: a data do dia, sem a virada de fuso empurrar para o dia vizinho.
  const weekday = weekdayOf(new Date(`${day}T12:00:00`));
  const [due] = routinesForWeekday(prescribed.routines, weekday);

  return (
    <Section
      title="Treino"
      size="compact"
      className="min-w-0"
      action={
        !nothingYet ? (
          <Link
            href="/treinos"
            className="text-xs text-ink-muted underline underline-offset-4 transition-colors duration-150 ease-out hover:text-ink"
          >
            Ver treinos
          </Link>
        ) : undefined
      }
    >
      <Card tone="default">
        {nothingYet ? (
          <Empty rest={rest} due={due} schedule={trainerScheduleLine(prescribed.routines)} />
        ) : (
          <ul className="space-y-2">
            {today.map((session) => (
              <li key={session.id}>
                <FinishedSession session={session} />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </Section>
  );
}

/**
 * The same shape as the meals block's empty state, and that is the point.
 *
 * These two answer the two halves of a day and sit side by side, so a
 * sentence here against an icon-and-button there made training read as the
 * lesser of the pair — a difference in treatment that says nothing true.
 * `Começar` is the same link to the same route it has always been; it moved
 * out of the header and put on the button the other block already wore.
 */
function Empty({
  rest,
  due,
  schedule,
}: {
  readonly rest: RestDayControl;
  /** O treino do treinador para hoje (Etapa 8e), se houver. */
  readonly due: PrescribedRoutine | undefined;
  /** Quando é o treino do treinador, num dia que não é dele. */
  readonly schedule: string | null;
}) {
  // Descanso marcado (roadmap 7.5): diz isso sem cobrar nada, e desfaz.
  if (rest.state.status === "ready" && rest.state.isRest) {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <ICONS.rest aria-hidden className="size-8 text-ink-subtle" />
        <div>
          <p className="text-sm text-ink">Dia de descanso.</p>
          <p className="mt-1 text-xs text-ink-subtle">
            Você marcou hoje como descanso. Nada muda na Evolução.
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            rest.setRest(false);
          }}
        >
          <Undo2 aria-hidden className="size-4" />
          Desfazer
        </Button>
        <SaveError message={rest.saveError} />
      </div>
    );
  }

  if (due !== undefined) return <DueRoutine routine={due} rest={rest} />;

  return (
    <div className="flex flex-col items-center gap-3 py-6 text-center">
      <ICONS.workouts aria-hidden className="size-8 text-ink-subtle" />
      <div>
        <p className="text-sm text-ink-muted">Nenhum treino registrado.</p>
        {/* Sprint 1: esta linha e a irmã em `today-meals.tsx` diziam ambas
            "Nada registrado hoje", com um "ainda" de diferença — duas frases
            quase idênticas empilhadas para dois fatos distintos. Cada uma
            agora nomeia o que falta e o que registrar ali resolve. */}
        <p className="mt-1 text-xs text-ink-subtle">
          {schedule ?? "Ao finalizar, volume e duração aparecem aqui."}
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Link href="/treinos" className={buttonClasses("secondary", "sm")}>
          Começar treino
        </Link>
        {/* Nunca automático: dia sem treino continua "Nenhum treino
            registrado" até a pessoa escolher. Sem o dado (erro de leitura),
            o botão não aparece. */}
        {rest.state.status === "ready" && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              rest.setRest(true);
            }}
          >
            <ICONS.rest aria-hidden className="size-4" />
            Hoje é descanso
          </Button>
        )}
      </div>
      <SaveError message={rest.saveError} />
    </div>
  );
}

/**
 * O dia é de um treino do treinador (protótipo aprovado em 01/10/2026): Hoje
 * só sugere. "Começar" inicia esse treino como qualquer outro; a pessoa pode
 * treinar outra coisa por Treinos, ou marcar descanso, e nada avisa treino
 * perdido (padrão até o Pedro decidir).
 */
function DueRoutine({ routine, rest }: { readonly routine: PrescribedRoutine; readonly rest: RestDayControl }) {
  const { start, starting, startError } = useStartRoutine();

  return (
    <div className="flex flex-col gap-3">
      <div className="min-w-0">
        <p className="text-xs text-ink-subtle">Treino de hoje · do seu treinador</p>
        <p className="mt-1 font-medium break-words text-ink">{routine.name}</p>
        <p className="mt-0.5 text-xs break-words text-ink-subtle">
          {routine.professionalName} · {describeRoutineSize(routine)}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          pending={starting}
          disabled={routine.exercises.length === 0}
          onClick={() => void start(prescribedAsRoutine(routine))}
        >
          <Play aria-hidden className="size-4" />
          Começar
        </Button>
        {rest.state.status === "ready" && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              rest.setRest(true);
            }}
          >
            <ICONS.rest aria-hidden className="size-4" />
            Hoje é descanso
          </Button>
        )}
      </div>
      <SaveError message={startError ?? rest.saveError} />
    </div>
  );
}

function SaveError({ message }: { readonly message: string | null }) {
  if (message === null) return null;
  return (
    <p role="alert" className="text-xs text-danger">
      {message}
    </p>
  );
}

function FinishedSession({ session }: { readonly session: Session }) {
  const duration = sessionDurationMs(session);
  const volume = sessionVolumeKg(session);

  // Achado de auditoria externa (27/08/2026): sem `aria-label`, o nome
  // acessível deste link era a concatenação crua dos três textos visíveis —
  // "Supino6:55·280 kg", sem separador nenhum para quem ouve em vez de ver.
  // O texto visível continua o mesmo; só o nome lido em voz alta ganha
  // vírgulas nos lugares onde a tela já usa "·" para separar visualmente.
  const durationLabel = duration === null ? "sem duração registrada" : formatDuration(duration);
  const accessibleName = `Ver treino ${session.name}, ${durationLabel}, ${formatDecimal(volume.kg)} kg movidos`;

  return (
    <Link
      href={`/sessao/${session.id}`}
      aria-label={accessibleName}
      className="flex min-h-(--control-h-sm) items-baseline gap-3 rounded-sm px-2 py-1.5 -mx-2 transition-colors duration-150 ease-out hover:bg-muted"
    >
      <span className="min-w-0 flex-1 truncate text-sm text-ink" aria-hidden>
        {session.name}
      </span>
      <span className="shrink-0 text-xs tabular-nums text-ink-muted" aria-hidden>
        {duration === null ? "—" : formatDuration(duration)}
        <span className="mx-1.5 text-line-strong">·</span>
        {formatDecimal(volume.kg)} kg
      </span>
    </Link>
  );
}
