"use client";

import { EQUIPMENT_LABELS } from "../taxonomy/equipment";
import {
  MOVEMENT_PATTERN_LABELS,
  MOVEMENT_PLANE_LABELS,
  TECHNICAL_DIFFICULTY_LABELS,
} from "../taxonomy/movement";
import { MUSCLE_LABELS } from "../taxonomy/muscles";
import type { MuscleGroup } from "../taxonomy/muscles";
import type { Exercise } from "../types/exercise";
import { ExercisePhotos } from "./exercise-photos";
import { MediaAttribution } from "./media-attribution";

/**
 * Everything the catalogue knows about one exercise.
 *
 * This screen exists because the curation was invisible. Secondary muscles,
 * stabilisers, movement pattern and plane were decided one exercise at a time
 * and then shown nowhere — the list row has space for a name and two tags.
 *
 * Empty fields are simply absent. `null` in this model means "nobody decided",
 * and printing "Padrão: —" would turn an honest gap into visible noise on
 * every row that has one.
 */
export function ExerciseDetail({ exercise }: { readonly exercise: Exercise }) {
  const hasPhotos = exercise.media !== null;

  return (
    <div className="space-y-6">
      {/* Side by side once there is room, so the photo stays large and the
          curation is readable without scrolling past it. Stacked below that,
          where a column each would leave both too narrow to be worth it. */}
      <div className="grid gap-6 md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <ExercisePhotos exercise={exercise} />

        {/* A description list, because that is what this is: terms and their
            values. `dl > div > dt + dd` is the grouping form. */}
        <dl className="space-y-3.5">
        <Muscles label="Músculos principais" muscles={exercise.primaryMuscles} />
        <Muscles label="Também trabalha" muscles={exercise.secondaryMuscles} />
        <Muscles
          label="Estabilizadores"
          muscles={exercise.stabilizerMuscles}
          hint="Trabalham para segurar a posição, não para mover a carga."
        />

        <Row
          label="Equipamento"
          values={exercise.equipment.map((item) => EQUIPMENT_LABELS[item])}
        />
        <Row
          label="Padrão"
          values={
            exercise.movementPattern === null
              ? []
              : [MOVEMENT_PATTERN_LABELS[exercise.movementPattern]]
          }
        />
        <Row
          label="Plano"
          values={exercise.movementPlanes.map((plane) => MOVEMENT_PLANE_LABELS[plane])}
        />
        <Row
          label="Dificuldade técnica"
          values={
            exercise.technicalDifficulty === null
              ? []
              : [TECHNICAL_DIFFICULTY_LABELS[exercise.technicalDifficulty]]
          }
          hint="Técnica exigida para carregar com segurança — não é o esforço."
        />
        <Row
          label="Tipo"
          values={[
            exercise.isCompound === null
              ? null
              : exercise.isCompound
                ? "Composto"
                : "Isolado",
            exercise.isUnilateral === true ? "Unilateral" : null,
          ].filter((value): value is string => value !== null)}
        />
          <Row label="Outros nomes" values={[...exercise.aliases]} />
        </dl>
      </div>

      {exercise.isCustom && (
        <p className="rounded-lg border border-line bg-muted px-4 py-3 text-xs text-ink-muted">
          Exercício criado por você. Uma revisão futura do catálogo não vai
          sobrescrevê-lo.
        </p>
      )}

      {hasPhotos && (
        <div className="-mx-5 -mb-5 border-t border-line">
          <MediaAttribution />
        </div>
      )}
    </div>
  );
}

function Muscles({
  label,
  muscles,
  hint,
}: {
  readonly label: string;
  readonly muscles: readonly MuscleGroup[];
  readonly hint?: string;
}) {
  return (
    <Row
      label={label}
      values={muscles.map((muscle) => MUSCLE_LABELS[muscle])}
      {...(hint === undefined ? {} : { hint })}
    />
  );
}

function Row({
  label,
  values,
  hint,
}: {
  readonly label: string;
  readonly values: readonly string[];
  readonly hint?: string;
}) {
  if (values.length === 0) return null;

  return (
    <div>
      <dt className="text-xs text-ink-subtle">{label}</dt>
      <dd>
        <p className="text-sm text-ink">{values.join(" · ")}</p>
        {hint !== undefined && (
          <p className="mt-0.5 text-xs text-ink-subtle">{hint}</p>
        )}
      </dd>
    </div>
  );
}
