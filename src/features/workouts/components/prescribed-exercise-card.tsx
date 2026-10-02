"use client";

import { NotebookPen } from "lucide-react";

import { formatDecimal } from "@/core/format/decimal";
import { Card } from "@/design-system/components/card";

import type { Exercise } from "../types/exercise";
import type { PlannedSet, RoutineExercise } from "../types/routine";
import { ExerciseIdentity } from "./exercise-identity";

const dash = (value: number | null, show: (n: number) => string = String) => (value === null ? "—" : show(value));

/**
 * Um exercício do treino do treinador, só leitura (Life Pro, Etapa 8d): a
 * mesma identidade e a mesma grade de séries do `RoutineExerciseCard`, sem os
 * controles. A observação do treinador fica embaixo, como a orientação da
 * refeição no plano.
 */
export function PrescribedExerciseCard({
  exercise,
  catalogue,
  onOpenDetail,
}: {
  readonly exercise: RoutineExercise;
  readonly catalogue: Exercise | undefined;
  readonly onOpenDetail: (exercise: Exercise) => void;
}) {
  const isCardio = catalogue?.movementPattern === "cardio";

  return (
    <Card as="li">
      <ExerciseIdentity name={exercise.name} catalogue={catalogue} onOpenDetail={onOpenDetail}>
        {null}
      </ExerciseIdentity>

      {/* As colunas do editor de rotina (`routine-exercise-card`), declaradas
          uma vez para cabeçalho e séries. */}
      <div
        style={
          {
            "--set-cols": isCardio
              ? "minmax(24px, 44px) minmax(72px, 140px)"
              : "minmax(24px, 44px) minmax(52px, 96px) minmax(44px, 72px) 44px",
          } as React.CSSProperties
        }
      >
        <div
          aria-hidden
          className="mt-3 set-grid items-center border-b border-line pb-1.5 text-[0.6875rem] font-medium tracking-wide text-ink-subtle uppercase"
        >
          <span />
          {isCardio ? (
            <span className="text-center">Duração (min)</span>
          ) : (
            <>
              <span className="text-center">Peso</span>
              <span className="text-center">Reps</span>
              <span className="text-center">RPE</span>
            </>
          )}
        </div>
        <ol className="mt-1">
          {exercise.sets.map((set, index) => (
            <SetRow key={set.id} set={set} index={index} isCardio={isCardio} />
          ))}
        </ol>
      </div>

      <p className="mt-3 border-t border-line pt-3 text-sm text-ink-muted">
        Descanso {exercise.restSeconds === null ? "—" : `${String(exercise.restSeconds)} seg`}
      </p>
      {exercise.notes.trim() !== "" && (
        <p className="mt-2 flex gap-2 text-sm break-words text-ink-muted">
          <NotebookPen aria-hidden className="mt-0.5 size-4 shrink-0 text-accent-text" />
          <span className="min-w-0">{exercise.notes}</span>
        </p>
      )}
    </Card>
  );
}

function SetRow({ set, index, isCardio }: { readonly set: PlannedSet; readonly index: number; readonly isCardio: boolean }) {
  const minutes = (seconds: number) => formatDecimal(seconds / 60);
  const kg = (value: number) => `${formatDecimal(value)} kg`;
  const label = isCardio
    ? `Série ${String(index + 1)}: ${dash(set.durationSeconds, (s) => `${minutes(s)} min`)}`
    : `Série ${String(index + 1)}: ${dash(set.weightKg, kg)}, ${dash(set.reps)} repetições, RPE ${dash(set.rpe)}`;

  return (
    <li aria-label={label} className="set-grid min-h-9 items-center border-b border-line text-center text-sm tabular-nums last:border-b-0">
      <span aria-hidden className="text-ink-subtle">
        {index + 1}
      </span>
      {isCardio ? (
        <span aria-hidden>{dash(set.durationSeconds, minutes)}</span>
      ) : (
        <>
          <span aria-hidden>{dash(set.weightKg, kg)}</span>
          <span aria-hidden>{dash(set.reps)}</span>
          <span aria-hidden>{dash(set.rpe)}</span>
        </>
      )}
    </li>
  );
}
