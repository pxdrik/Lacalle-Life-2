"use client";

import { CalendarDays, Copy, Play } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";

import { describeRoutineDays } from "@/core/domain/weekday";
import { Badge } from "@/design-system/components/badge";
import { Card } from "@/design-system/components/card";

import { useOptionalPrescribedRoutineRepository } from "../data/prescribed-routine-repository-context";
import { describeRoutineSize, isUpdated } from "../services/prescribed-routine";
import type { PrescribedRoutine } from "../types/prescribed-routine";
import { RoutineChangesNotice } from "./routine-changes-notice";

export const PRESCRIBED_DATE = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" });

export const prescribedRoutineHref = (id: string) => `/treinos/prescrito/${id}` as Route;

/**
 * "Do seu treinador" em Treinos (protótipo aprovado em 01/10/2026): o treino
 * fica separado dos treinos da pessoa, com a etiqueta "Profissional", e abre
 * só para leitura. Iniciar é como qualquer treino; para mudar algo, "Fazer uma
 * cópia", que vira um treino dela. Os dias são do treinador, só para leitura.
 * Versão nova ainda não aberta: "Atualizado" e o que mudou (Etapa 8f).
 */
export function PrescribedRoutinesSection({
  routines,
  starting,
  onStart,
  onCopy,
}: {
  readonly routines: readonly PrescribedRoutine[];
  readonly starting: boolean;
  readonly onStart: (routine: PrescribedRoutine) => void;
  readonly onCopy: (routine: PrescribedRoutine) => void;
}) {
  const repository = useOptionalPrescribedRoutineRepository();

  return (
    <section aria-labelledby="treinos-recebidos" className="space-y-2">
      <h2 id="treinos-recebidos" className="text-xs font-medium tracking-wide text-ink-subtle uppercase">
        Do seu treinador
      </h2>
      <ul className="space-y-2">
        {routines.map((routine) => (
          <li key={routine.id}>
            <Card padded={false} className="transition-colors duration-150 ease-out hover:border-line-strong">
              <Link href={prescribedRoutineHref(routine.id)} className="block p-4 pb-3">
                <p className="flex flex-wrap items-center gap-2">
                  <span className="min-w-0 font-medium break-words text-ink">{routine.name}</span>
                  <Badge state="concluido">Profissional</Badge>
                  {isUpdated(routine) && <Badge state="atencao">Atualizado</Badge>}
                </p>
                <p className="mt-0.5 text-xs break-words text-ink-subtle">
                  {routine.professionalName} · versão {routine.version},{" "}
                  {PRESCRIBED_DATE.format(new Date(routine.publishedAt))} · {describeRoutineSize(routine)}
                </p>
              </Link>
              {isUpdated(routine) && (
                <RoutineChangesNotice
                  routine={routine}
                  onSeen={() => {
                    void repository?.then((repo) => repo.markSeen(routine.id, routine.version)).catch(() => undefined);
                  }}
                />
              )}
              {/* Como a linha do plano em Dietas: os dias na largura deles, e
                  Iniciar e a cópia descem para a linha de baixo quando não
                  cabem. Com `flex-1` os dias encolhiam até virar uma coluna de
                  um dia por linha (320px, Confortável). */}
              <div className="flex flex-wrap items-center gap-x-2 border-t border-line px-2 py-1">
                <p className="flex min-h-11 min-w-0 items-center gap-1.5 px-2 text-sm text-ink-muted">
                  <CalendarDays aria-hidden className="size-4 shrink-0" />
                  <span className="sr-only">Dias do treino:</span>
                  {describeRoutineDays(routine.weekdays)}
                </p>
                <button
                  type="button"
                  disabled={starting || routine.exercises.length === 0}
                  onClick={() => {
                    onStart(routine);
                  }}
                  aria-label={`Iniciar ${routine.name}`}
                  className="ml-auto flex min-h-11 items-center gap-1.5 rounded-md px-2 text-sm font-medium text-accent-text transition-colors duration-150 ease-out hover:bg-muted disabled:opacity-50"
                >
                  <Play aria-hidden className="size-4 shrink-0" />
                  Iniciar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onCopy(routine);
                  }}
                  aria-label={`Fazer uma cópia de ${routine.name}`}
                  className="flex size-11 items-center justify-center rounded-md text-ink-subtle transition-colors duration-150 ease-out hover:bg-muted hover:text-ink"
                >
                  <Copy aria-hidden className="size-4" />
                </button>
              </div>
            </Card>
          </li>
        ))}
      </ul>
    </section>
  );
}
