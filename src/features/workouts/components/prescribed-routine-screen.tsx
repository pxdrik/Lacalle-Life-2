"use client";

import { ArrowLeft, CalendarDays, Copy, Lock, Play } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";

import { describeRoutineDays } from "@/core/domain/weekday";
import { cn } from "@/design-system/cn";
import { Badge } from "@/design-system/components/badge";
import { Button } from "@/design-system/components/button";
import { noticeClasses } from "@/design-system/components/notice";
import { Skeleton } from "@/design-system/components/skeleton";
import { useToast } from "@/design-system/components/toast";

import { useOptionalPrescribedRoutineRepository } from "../data/prescribed-routine-repository-context";
import { useExerciseLookup } from "../hooks/use-exercise-lookup";
import { usePrescribedRoutines } from "../hooks/use-prescribed-routines";
import { useRoutineList } from "../hooks/use-routine-list";
import { useStartRoutine } from "../hooks/use-start-routine";
import { prescribedAsRoutine } from "../services/prescribed-routine";
import { ExerciseDetailDialog, useExerciseDetail } from "./exercise-detail-dialog";
import { PrescribedExerciseCard } from "./prescribed-exercise-card";
import { PRESCRIBED_DATE } from "./prescribed-routines-section";

/**
 * O treino do treinador, aberto para leitura (protótipo aprovado em
 * 01/10/2026). Iniciar fica no topo; durante a sessão a pessoa ajusta carga e
 * repetições como sempre, e o treino prescrito não muda. Para mudar algo por
 * conta própria, uma cópia, que vira um treino dela. Abrir marca a versão
 * como vista (o "Atualizado" da Etapa 8f).
 */
export function PrescribedRoutineScreen({ routineId }: { readonly routineId: string }) {
  const state = usePrescribedRoutines();
  const repository = useOptionalPrescribedRoutineRepository();
  const { duplicate, writeError } = useRoutineList();
  const { start, starting, startError } = useStartRoutine();
  const lookup = useExerciseLookup();
  const detail = useExerciseDetail();
  const toast = useToast();
  const prescribed = state.status === "ready" ? state.routines.find((item) => item.id === routineId) : undefined;
  const version = prescribed?.version;

  useEffect(() => {
    if (repository === null || version === undefined) return;
    void repository.then((repo) => repo.markSeen(routineId, version)).catch(() => undefined);
  }, [repository, routineId, version]);

  const back = (
    <Link
      href="/treinos"
      className="inline-flex h-8 items-center gap-1.5 text-sm text-ink-muted transition-colors duration-150 ease-out hover:text-ink"
    >
      <ArrowLeft aria-hidden className="size-4" />
      Treinos
    </Link>
  );

  if (state.status === "loading") {
    return (
      <>
        {back}
        <Skeleton className="mt-4 h-64" />
      </>
    );
  }

  if (prescribed === undefined) {
    return (
      <>
        {back}
        <div role="alert" className={cn(noticeClasses("danger", "block"), "mt-4")}>
          <p className="text-ink">Este treino não está neste aparelho.</p>
          <p className="mt-1.5 text-sm text-ink-muted">Confira a conexão e abra Treinos de novo.</p>
        </div>
      </>
    );
  }

  const routine = prescribedAsRoutine(prescribed);
  const error = startError ?? writeError;

  return (
    <>
      {back}
      <header className="mt-4">
        <h1 className="text-h2 font-bold break-words text-balance md:text-h1">{prescribed.name}</h1>
        <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-ink-muted">
          <Badge state="concluido">Profissional</Badge>
          {prescribed.professionalName} · versão {prescribed.version},{" "}
          {PRESCRIBED_DATE.format(new Date(prescribed.publishedAt))}
        </p>
        <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-muted">
          <CalendarDays aria-hidden className="size-4 shrink-0" />
          <span className="sr-only">Dias do treino:</span>
          {describeRoutineDays(prescribed.weekdays)}
        </p>
      </header>

      {prescribed.linkEnded && (
        <p className={cn(noticeClasses("info"), "mt-4")}>
          O acompanhamento terminou. O treino continua aqui, sem versões novas.
        </p>
      )}

      {error !== null && (
        <p role="alert" className={cn(noticeClasses(), "mt-4")}>
          {error}
        </p>
      )}

      <Button
        className="mt-4 w-full"
        pending={starting}
        disabled={routine.exercises.length === 0}
        onClick={() => void start(routine)}
      >
        <Play aria-hidden className="size-4" />
        Iniciar treino
      </Button>

      <ul className="mt-4 space-y-3">
        {routine.exercises.map((exercise) => (
          <PrescribedExerciseCard
            key={exercise.id}
            exercise={exercise}
            catalogue={lookup.get(exercise.exerciseId)}
            onOpenDetail={detail.show}
          />
        ))}
      </ul>

      <p className={cn(noticeClasses("info"), "mt-4 flex gap-2")}>
        <Lock aria-hidden className="mt-0.5 size-4 shrink-0" />
        <span className="min-w-0">
          Só {prescribed.professionalName} altera este treino. Para mudar algo por conta própria, faça uma cópia: ela
          vira um treino seu.
        </span>
      </p>
      <Button
        variant="secondary"
        className="mt-3 w-full"
        onClick={() => {
          void duplicate(routine).then((copied) => {
            if (copied) toast("Cópia criada em Seus treinos.");
          });
        }}
      >
        <Copy aria-hidden className="size-4" />
        Fazer uma cópia
      </Button>

      <ExerciseDetailDialog control={detail} />
    </>
  );
}
