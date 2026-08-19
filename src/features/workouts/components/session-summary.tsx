"use client";

import { Pencil, Trash2 } from "lucide-react";
import Link from "next/link";

import { formatDecimal } from "@/core/format/decimal";
import { Button, buttonClasses } from "@/design-system/components/button";
import { ConfirmButton } from "@/design-system/components/confirm-button";
import { Notice } from "@/design-system/components/notice";

import {
  comparePlanned,
  formatDuration,
  sessionDurationMs,
  sessionProgress,
  sessionVolumeKg,
} from "../services/session-stats";
import type { Session } from "../types/session";
import { Card } from "@/design-system/components/card";

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
          <h1 className="mt-1 truncate text-2xl font-medium tracking-normal">
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

      {/* What the session was, in three numbers — the reason this screen is
          opened, with the per-exercise breakdown below for when it is not
          enough. */}
      <Card as="dl" tone="hero" className="mt-6 grid grid-cols-3 gap-4">
        <Figure
          label="Duração"
          value={formatDuration(sessionDurationMs(session) ?? 0)}
        />
        <Figure
          label="Séries"
          value={`${String(progress.completed)}/${String(progress.total)}`}
        />
        <Figure label="Volume" value={`${formatDecimal(volume.kg)} kg`} />
      </Card>

      {/* BUG-017 (auditoria externa, 14/08): esta é a versão permanente do
          mesmo aviso que aparece na hora de finalizar, em `session-runner.tsx`
          — este relatório é o que fica, e é revisitado depois, então o motivo
          do número não bater com "somar tudo que a lista abaixo mostra" tem
          que estar aqui também, não só no instante do término. */}
      {volume.excludedSets > 0 && (
        <Notice tone="warning" className="mt-4">
          {volume.excludedSets === 1
            ? "1 série concluída ficou de fora do volume: tem peso registrado, mas sem repetições."
            : `${String(volume.excludedSets)} séries concluídas ficaram de fora do volume: têm peso registrado, mas sem repetições.`}
        </Notice>
      )}

      <div className="mt-4 space-y-3">
        {session.exercises.map((exercise) => (
          <Card as="section" key={exercise.id}>
            <h2 className="font-medium text-ink">{exercise.name}</h2>

            <ul className="mt-2 space-y-1">
              {exercise.sets.map((set, index) => {
                const { rpeDelta } = comparePlanned(set);

                return (
                  <li
                    key={set.id}
                    className="flex items-baseline gap-3 text-sm tabular-nums"
                  >
                    <span className="w-5 text-ink-subtle">{index + 1}</span>

                    {set.isCompleted ? (
                      <span className="text-ink">
                        {set.reps ?? "—"} ×{" "}
                        {set.weightKg === null
                          ? "—"
                          : formatDecimal(set.weightKg)}{" "}
                        kg
                        {set.rpe !== null && (
                          <span className="text-ink-muted">
                            {" "}
                            · RPE {set.rpe}
                          </span>
                        )}
                      </span>
                    ) : set.reps !== null || set.weightKg !== null ? (
                      // Digitado mas nunca confirmado no check — auditoria
                      // externa de 19/08 (BUG-009): finalizar sem confirmar
                      // lia como "não realizada", e o valor digitado (que
                      // continua salvo, `isCompleted` só controla a marcação)
                      // desaparecia da tela como se tivesse sido descartado.
                      <span className="text-ink-subtle">
                        {set.reps ?? "—"} ×{" "}
                        {set.weightKg === null
                          ? "—"
                          : formatDecimal(set.weightKg)}{" "}
                        kg <span className="italic">(não confirmada)</span>
                      </span>
                    ) : (
                      <span className="text-ink-subtle">não realizada</span>
                    )}

                    {/* Shown only when it differs — a delta of zero is noise. */}
                    {rpeDelta !== null && rpeDelta !== 0 && (
                      <span
                        className={
                          rpeDelta > 0 ? "text-danger" : "text-ink-subtle"
                        }
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
          </Card>
        ))}
      </div>

      <div className="mt-6 flex gap-3">
        <Link href="/evolucao" className={buttonClasses()}>
          Ver histórico
        </Link>
        <Link href="/treinos" className={buttonClasses("secondary")}>
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
      <dd className="text-xl tabular-nums text-ink">{value}</dd>
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
