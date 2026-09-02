"use client";

import { Flag, Play } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { describeDataError } from "@/core/domain/describe-data-error";
import { cn } from "@/design-system/cn";
import { Button, buttonClasses } from "@/design-system/components/button";
import { cardSurface } from "@/design-system/components/card";

import { useWorkoutRepositories } from "../data/workout-repository-context";
import { useSessionHistory } from "../hooks/use-session-history";
import { useTicker } from "../hooks/use-ticker";
import { finishSession } from "../services/edit-session";
import {
  formatDuration,
  isStaleSession,
  sessionProgress,
  staleSessionDays,
} from "../services/session-stats";
import type { Session } from "../types/session";

/**
 * The workout left open.
 *
 * Without this a session started and abandoned is orphaned: the record sits in
 * storage, correct and complete, reachable only by its exact URL. Phones get
 * locked and tabs get closed mid-workout, so this is the normal case, not the
 * edge one.
 */
export function InProgressBanner() {
  const state = useSessionHistory();
  // Half a minute is precise enough for "started an hour ago", and reading the
  // clock during render would be impure.
  const now = useTicker(true, 30_000);
  // Sessão encerrada por este banner some da tela sem esperar um reload —
  // `useSessionHistory` carrega uma vez só (ver o comentário no hook), então
  // esta é a única forma de refletir o "Encerrar" imediatamente aqui.
  const [endedId, setEndedId] = useState<string | null>(null);

  if (state.status !== "ready" || state.inProgress === undefined) return null;
  if (state.inProgress.id === endedId) return null;

  const session = state.inProgress;
  const progress = sessionProgress(session);

  if (isStaleSession(session, now)) {
    return (
      <StaleSessionBanner
        session={session}
        now={now}
        progress={progress}
        onEnded={() => {
          setEndedId(session.id);
        }}
      />
    );
  }

  return (
    <Link
      href={`/sessao/${session.id}`}
      // It appears only after the session data loads, so without this it snaps
      // in and shoves the list down. Rising in makes the arrival legible.
      //
      // O destaque virou a linha lateral de 3 px do cartão destacado (pág. 24).
      // Era borda de acento em volta do cartão inteiro sobre fundo de acento a
      // 5%, e a mesma página proíbe as duas coisas por nome: "borda colorida no
      // card inteiro" e "card com fundo no acento inteiro". A hierarquia não
      // muda — este continua sendo o único cartão destacado da tela.
      //
      // `cardSurface("hero")` em vez da receita escrita à mão que vivia aqui
      // — Sprint 8: era uma cópia exata das mesmas classes que `Card
      // tone="hero"` já centraliza, só porque este elemento precisa continuar
      // sendo um `<Link>`, não um `Card`. `cardSurface` existe desde a
      // extração do `Card` exatamente para este caso.
      className={cn(
        cardSurface("hero"),
        "animate-rise flex items-center gap-4 transition-colors duration-(--duration-micro) ease-out hover:border-line-strong",
      )}
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-sm bg-accent text-accent-ink">
        <Play aria-hidden className="size-5" />
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-ink">{session.name}</p>
        <p className="mt-0.5 text-xs text-ink-muted">
          Em andamento
          <span className="mx-1.5 text-line-strong">·</span>
          {progress.completed}/{progress.total} séries
          <span className="mx-1.5 text-line-strong">·</span>
          começou há {formatDuration(Math.max(0, now - session.startedAt))}
        </p>
      </div>

      <span className="shrink-0 text-sm font-medium text-ink">Continuar</span>
    </Link>
  );
}

/**
 * Uma sessão aberta desde um dia de calendário anterior.
 *
 * Achado de auditoria de design (02/09/2026): o card comum, com seu
 * cronômetro cru (`começou há 116:42:45`) e o único botão "Continuar", fazia
 * essa sessão parecer "em andamento" agora mesmo — e, na lista de treinos
 * logo abaixo, a mesma rotina aparecia como "nunca executado", porque
 * `executionTrail` (corretamente) só conta sessões finalizadas. As duas
 * frases não se contradizem tecnicamente, mas lidas juntas pareciam um bug.
 *
 * A correção não é esconder nem apagar nada sozinha — é parar de fingir que
 * isto é uma sessão comum. Duração vira "iniciado há N dias" em vez de um
 * relógio, e a única ação implícita ("toque para continuar") vira duas
 * explícitas: retomar o treino de onde parou, ou encerrá-lo agora com o que
 * já foi registrado (o mesmo `finishSession` que o botão "Finalizar" da tela
 * de execução usa — nenhuma série é descartada).
 */
function StaleSessionBanner({
  session,
  now,
  progress,
  onEnded,
}: {
  readonly session: Session;
  readonly now: number;
  readonly progress: { readonly completed: number; readonly total: number };
  readonly onEnded: () => void;
}) {
  const repositories = useWorkoutRepositories();
  const [ending, setEnding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const days = staleSessionDays(session, now);

  async function end() {
    setEnding(true);
    setError(null);
    try {
      const finished = finishSession(session, now);
      await (await repositories).sessions.save(finished, session.updatedAt);
      onEnded();
    } catch (cause) {
      setError(describeDataError(cause));
      setEnding(false);
    }
  }

  return (
    <div
      className={cn(
        cardSurface("hero"),
        "animate-rise flex flex-col gap-3 sm:flex-row sm:items-center",
      )}
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-sm bg-accent text-accent-ink">
        <Play aria-hidden className="size-5" />
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-ink">{session.name}</p>
        <p className="mt-0.5 text-xs text-ink-muted">
          Treino em andamento
          <span className="mx-1.5 text-line-strong">·</span>
          {progress.completed}/{progress.total} séries
          <span className="mx-1.5 text-line-strong">·</span>
          iniciado há {days === 1 ? "1 dia" : `${String(days)} dias`}
        </p>
        {error !== null && (
          <p className="mt-1 text-xs text-danger-text">{error}</p>
        )}
      </div>

      <div className="flex shrink-0 gap-2">
        <Button
          variant="secondary"
          size="sm"
          pending={ending}
          onClick={() => void end()}
        >
          <Flag aria-hidden className="size-4" />
          Encerrar
        </Button>
        <Link href={`/sessao/${session.id}`} className={buttonClasses("primary", "sm")}>
          Retomar
        </Link>
      </div>
    </div>
  );
}
