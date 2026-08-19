"use client";

import { Play } from "lucide-react";
import Link from "next/link";

import { cn } from "@/design-system/cn";
import { cardSurface } from "@/design-system/components/card";

import { useSessionHistory } from "../hooks/use-session-history";
import { useTicker } from "../hooks/use-ticker";
import { formatDuration, sessionProgress } from "../services/session-stats";

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

  if (state.status !== "ready" || state.inProgress === undefined) return null;

  const session = state.inProgress;
  const progress = sessionProgress(session);

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
