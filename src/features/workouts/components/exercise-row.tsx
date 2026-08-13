"use client";

import { Plus, Star } from "lucide-react";

import { cn } from "@/design-system/cn";

import { EQUIPMENT_LABELS } from "../taxonomy/equipment";
import { TECHNICAL_DIFFICULTY_LABELS } from "../taxonomy/movement";
import { MUSCLE_LABELS } from "../taxonomy/muscles";
import type { Exercise } from "../types/exercise";
import { ExerciseThumbnail } from "./exercise-thumbnail";

interface Props {
  readonly exercise: Exercise;
  readonly onToggleFavorite: (exercise: Exercise) => void;
  /** Present in selection mode — the row gains an add button. */
  readonly onSelect?: ((exercise: Exercise) => void) | undefined;
  readonly onOpenDetail: (exercise: Exercise) => void;
}

export function ExerciseRow({
  exercise,
  onToggleFavorite,
  onSelect,
  onOpenDetail,
}: Props) {
  const muscles = exercise.primaryMuscles
    .map((m) => MUSCLE_LABELS[m])
    .join(" · ");
  const equipment = exercise.equipment
    .map((e) => EQUIPMENT_LABELS[e])
    .join(" · ");

  return (
    <li className="group flex items-center gap-3 px-3 py-2.5 transition-colors duration-100 ease-out hover:bg-muted">
      {/* Photo and name are one button, not two: they answer the same
          question, and two adjacent controls doing the same thing is an extra
          tab stop for no gain. */}
      <button
        type="button"
        onClick={() => {
          onOpenDetail(exercise);
        }}
        aria-label={`Ver detalhes de ${exercise.name}`}
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
      >
        <ExerciseThumbnail exercise={exercise} />

        <span className="min-w-0 flex-1">
          <span className="block truncate text-[0.9375rem] text-ink">
            {exercise.name}
          </span>
          <span className="mt-0.5 block truncate text-xs text-ink-subtle">
            {muscles}
            <span className="mx-1.5 text-line-strong">|</span>
            {equipment}
            {exercise.isCustom && " · seu exercício"}
          </span>
        </span>
      </button>

      <div className="hidden shrink-0 items-center gap-2 sm:flex">
        {exercise.isCompound === true && <Tag>Composto</Tag>}
        {exercise.isUnilateral === true && <Tag>Unilateral</Tag>}
        {exercise.technicalDifficulty !== null && (
          <Tag>{TECHNICAL_DIFFICULTY_LABELS[exercise.technicalDifficulty]}</Tag>
        )}
      </div>

      {/*
        The star sits with the other actions rather than in the first column.
        Favouriting is the rarest thing anyone does to a row, and it was
        occupying the position the eye lands on first.
      */}
      <button
        type="button"
        onClick={() => {
          onToggleFavorite(exercise);
        }}
        aria-pressed={exercise.isFavorite}
        aria-label={
          exercise.isFavorite
            ? `Remover ${exercise.name} dos favoritos`
            : `Favoritar ${exercise.name}`
        }
        className={cn(
          "flex size-8 shrink-0 items-center justify-center touch-44 rounded-md",
          "transition-colors duration-150 ease-out hover:bg-line",
          exercise.isFavorite
            ? "text-ink"
            : "text-ink-subtle/40 group-hover:text-ink-subtle/70",
        )}
      >
        <Star
          aria-hidden
          className="size-4"
          fill={exercise.isFavorite ? "currentColor" : "none"}
        />
      </button>

      {onSelect !== undefined && (
        <button
          type="button"
          onClick={() => {
            onSelect(exercise);
          }}
          aria-label={`Adicionar ${exercise.name}`}
          className="flex size-8 shrink-0 items-center justify-center touch-44 rounded-md bg-accent text-accent-ink transition-opacity duration-150 ease-out hover:opacity-90"
        >
          <Plus aria-hidden className="size-4" />
        </button>
      )}
    </li>
  );
}

function Tag({ children }: { readonly children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-line px-2 py-0.5 text-[0.6875rem] text-ink-subtle">
      {children}
    </span>
  );
}
