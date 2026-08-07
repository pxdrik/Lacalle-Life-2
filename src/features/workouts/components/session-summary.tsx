"use client";

import { Pencil, Trash2 } from "lucide-react";
import Link from "next/link";

import { Button } from "@/design-system/components/button";
import { ConfirmButton } from "@/design-system/components/confirm-button";

import {
  comparePlanned,
  formatDuration,
  sessionDurationMs,
  sessionProgress,
  sessionVolumeKg,
} from "../services/session-stats";
import type { Session } from "../types/session";

interface Props {
  readonly session: Session;
  readonly onEdit: () => void;
  readonly onDelete: () => void;
}

/**
 * What the workout was, once it is over.
 *
 * The plan-versus-reality column is the reason every set carries a frozen
 * `planned`: "I planned 8 at RPE 8 and did 6 at RPE 9" is the sentence that
 * makes next week's plan better, and it is unrecoverable if the routine is
 * consulted instead.
 */
export function SessionSummary({ session, onEdit, onDelete }: Props) {
  const progress = sessionProgress(session);
  const volume = sessionVolumeKg(session);

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm text-ink-muted">
            Treino concluído
            <span className="mx-1.5 text-line-strong">·</span>
            {formatDate(session.startedAt)}
          </p>
          <h1 className="mt-1 truncate text-2xl font-semibold tracking-tight">
            {session.name}
          </h1>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <Button variant="ghost" size="sm" onClick={onEdit}>
            <Pencil aria-hidden className="size-4" />
            Editar
          </Button>
          <ConfirmButton
            onConfirm={onDelete}
            label={`Excluir treino ${session.name}`}
            confirmLabel="Excluir?"
            className="h-8 min-w-8"
          >
            <Trash2 aria-hidden className="size-4" />
          </ConfirmButton>
        </div>
      </div>

      <dl className="mt-6 grid grid-cols-3 gap-4 rounded-xl border border-line bg-surface p-5">
        <Figure
          label="Duração"
          value={formatDuration(sessionDurationMs(session) ?? 0)}
        />
        <Figure
          label="Séries"
          value={`${String(progress.completed)}/${String(progress.total)}`}
        />
        <Figure label="Volume" value={`${volume.toLocaleString("pt-BR")} kg`} />
      </dl>

      <div className="mt-4 space-y-3">
        {session.exercises.map((exercise) => (
          <section
            key={exercise.id}
            className="rounded-xl border border-line bg-surface p-4"
          >
            <h2 className="font-medium text-ink">{exercise.name}</h2>

            <ul className="mt-2 space-y-1">
              {exercise.sets.map((set, index) => {
                const { rpeDelta } = comparePlanned(set);

                return (
                  <li
                    key={set.id}
                    className="flex items-baseline gap-3 font-mono text-sm tabular-nums"
                  >
                    <span className="w-5 text-ink-subtle">{index + 1}</span>

                    {set.isCompleted ? (
                      <span className="text-ink">
                        {set.reps ?? "—"} × {set.weightKg ?? "—"} kg
                        {set.rpe !== null && (
                          <span className="text-ink-muted"> · RPE {set.rpe}</span>
                        )}
                      </span>
                    ) : (
                      <span className="text-ink-subtle">não realizada</span>
                    )}

                    {/* Shown only when it differs — a delta of zero is noise. */}
                    {rpeDelta !== null && rpeDelta !== 0 && (
                      <span
                        className={rpeDelta > 0 ? "text-danger" : "text-ink-subtle"}
                      >
                        {rpeDelta > 0 ? "+" : ""}
                        {rpeDelta} vs plano
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>

            {exercise.notes !== "" && (
              <p className="mt-2 text-sm text-ink-muted">{exercise.notes}</p>
            )}
          </section>
        ))}
      </div>

      <div className="mt-6 flex gap-3">
        <Link
          href="/evolucao"
          className="inline-flex h-11 items-center rounded-lg bg-accent px-5 text-sm font-medium text-accent-ink transition-opacity duration-150 ease-out hover:opacity-90"
        >
          Ver histórico
        </Link>
        <Link
          href="/treinos"
          className="inline-flex h-11 items-center rounded-lg border border-line px-5 text-sm text-ink-muted transition-colors duration-150 ease-out hover:border-line-strong hover:text-ink"
        >
          Treinos
        </Link>
      </div>
    </div>
  );
}

function Figure({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string;
}) {
  return (
    <div>
      <dd className="font-mono text-xl tabular-nums text-ink">{value}</dd>
      <dt className="mt-0.5 text-xs text-ink-subtle">{label}</dt>
    </div>
  );
}

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "long",
  year: "numeric",
});

function formatDate(timestamp: number): string {
  return dateFormatter.format(new Date(timestamp));
}
