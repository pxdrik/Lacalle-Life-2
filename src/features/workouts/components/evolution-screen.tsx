"use client";

import Link from "next/link";

import { useSessionHistory } from "../hooks/use-session-history";
import {
  finishedSessions,
  personalRecords,
  startOfMonth,
  startOfWeek,
  volumeByPeriod,
  type VolumePoint,
} from "../services/history";
import {
  formatDuration,
  sessionDurationMs,
  sessionProgress,
  sessionVolumeKg,
} from "../services/session-stats";
import type { Session } from "../types/session";
import { VolumeChart } from "./volume-chart";

export function EvolutionScreen() {
  const state = useSessionHistory();

  if (state.status === "loading") {
    return (
      <div aria-hidden className="space-y-4">
        <div className="h-40 w-full rounded-xl bg-muted" />
        <div className="h-64 w-full rounded-xl bg-muted" />
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div
        role="alert"
        className="rounded-xl border border-danger/30 bg-danger/5 px-6 py-8 text-center"
      >
        <p className="text-ink">Não foi possível carregar seu histórico.</p>
        <p className="mt-1.5 text-sm text-ink-muted">{state.message}</p>
      </div>
    );
  }

  const history = finishedSessions(state.sessions);

  if (history.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-line px-6 py-14 text-center">
        <p className="text-ink">Nenhum treino concluído ainda.</p>
        <p className="mt-1.5 text-sm text-ink-subtle">
          Assim que você finalizar um treino, ele aparece aqui com volume,
          recordes e histórico.
        </p>
        <Link
          href="/treinos"
          className="mt-5 inline-block text-sm text-ink underline underline-offset-4"
        >
          Ir para os treinos
        </Link>
      </div>
    );
  }

  const weekly = volumeByPeriod(history, 12, startOfWeek);
  const monthly = volumeByPeriod(history, 6, startOfMonth);
  const records = personalRecords(history);

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-sm font-medium text-ink">Volume semanal</h2>
        <p className="mt-0.5 text-xs text-ink-subtle">
          Últimas 12 semanas, em quilos movidos
        </p>
        <div className="mt-3">
          <VolumeChart points={weekly} format={formatWeek} />
        </div>
      </section>

      <section>
        <h2 className="text-sm font-medium text-ink">Volume mensal</h2>
        <div className="mt-3">
          <VolumeChart points={monthly} format={formatMonth} />
        </div>
      </section>

      {records.length > 0 && (
        <section>
          <h2 className="text-sm font-medium text-ink">Recordes</h2>
          <p className="mt-0.5 text-xs text-ink-subtle">
            Série mais pesada e melhor estimativa de 1RM — quase sempre séries
            diferentes
          </p>

          <ul className="mt-3 divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
            {records.slice(0, 12).map((record) => (
              <li
                key={record.exerciseId}
                className="flex items-center gap-3 px-4 py-3"
              >
                <span className="min-w-0 flex-1 truncate text-sm text-ink">
                  {record.name}
                </span>
                <span className="shrink-0 font-mono text-sm tabular-nums text-ink">
                  {record.repsAtHeaviest} × {record.heaviestKg} kg
                </span>
                <span className="w-20 shrink-0 text-right font-mono text-xs tabular-nums text-ink-muted">
                  1RM {record.bestOneRepMax}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="text-sm font-medium text-ink">Histórico</h2>
        <ul className="mt-3 space-y-2">
          {history.map((session) => (
            <SessionRow key={session.id} session={session} />
          ))}
        </ul>
      </section>
    </div>
  );
}

function SessionRow({ session }: { readonly session: Session }) {
  const progress = sessionProgress(session);
  const duration = sessionDurationMs(session);

  return (
    <li>
      <Link
        href={`/sessao/${session.id}`}
        className="flex items-center gap-4 rounded-xl border border-line bg-surface p-4 transition-colors duration-150 ease-out hover:border-line-strong"
      >
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-ink">{session.name}</p>
          <p className="mt-0.5 text-xs text-ink-subtle">
            {formatDate(session.startedAt)}
            <span className="mx-1.5 text-line-strong">·</span>
            {progress.completed}/{progress.total} séries
            {duration !== null && (
              <>
                <span className="mx-1.5 text-line-strong">·</span>
                {formatDuration(duration)}
              </>
            )}
          </p>
        </div>

        <span className="shrink-0 font-mono text-sm tabular-nums text-ink-muted">
          {sessionVolumeKg(session).toLocaleString("pt-BR")} kg
        </span>
      </Link>
    </li>
  );
}

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

function formatDate(timestamp: number): string {
  return dateFormatter.format(new Date(timestamp));
}

function formatWeek(point: VolumePoint): string {
  const date = new Date(point.startsAt);
  return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}`;
}

const monthFormatter = new Intl.DateTimeFormat("pt-BR", { month: "short" });

function formatMonth(point: VolumePoint): string {
  return monthFormatter.format(new Date(point.startsAt));
}
