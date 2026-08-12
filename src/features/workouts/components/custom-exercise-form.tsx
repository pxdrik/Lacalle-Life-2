"use client";

import { useState } from "react";

import { cn } from "@/design-system/cn";
import { Button } from "@/design-system/components/button";
import { cardSurface } from "@/design-system/components/card";
import { Field } from "@/design-system/components/field";
import { Input } from "@/design-system/components/input";

import { EQUIPMENT, EQUIPMENT_LABELS } from "../taxonomy/equipment";
import { MUSCLE_GROUPS, MUSCLE_LABELS } from "../taxonomy/muscles";
import type { Equipment } from "../taxonomy/equipment";
import type { MuscleGroup } from "../taxonomy/muscles";
import {
  customExerciseSchema,
  type CustomExerciseInput,
} from "../validation/custom-exercise-schema";

interface Props {
  /** Prefilled from what the user was searching for when they came up empty. */
  readonly initialName: string;
  readonly pending: boolean;
  readonly onSubmit: (input: CustomExerciseInput) => void;
  readonly onCancel: () => void;
}

function toggle<T>(set: ReadonlySet<T>, value: T): Set<T> {
  const next = new Set(set);
  if (!next.delete(value)) next.add(value);
  return next;
}

/**
 * Creating an exercise the catalogue does not have.
 *
 * The name is the only required field, and the form makes that visible: the
 * submit button is live the moment there is a name. Muscles and equipment sit
 * below it, marked optional, because they improve the filters later and must
 * never stand between someone and logging their set.
 */
export function CustomExerciseForm({
  initialName,
  pending,
  onSubmit,
  onCancel,
}: Props) {
  const [name, setName] = useState(initialName);
  const [muscles, setMuscles] = useState<ReadonlySet<MuscleGroup>>(new Set());
  const [equipment, setEquipment] = useState<ReadonlySet<Equipment>>(new Set());
  const [error, setError] = useState<string | undefined>(undefined);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    const parsed = customExerciseSchema.safeParse({
      name,
      primaryMuscles: [...muscles],
      equipment: [...equipment],
    });

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message);
      return;
    }

    setError(undefined);
    onSubmit(parsed.data);
  }

  return (
    <form onSubmit={handleSubmit} className={cn(cardSurface(), "space-y-4")}>
      <Field label="Nome do exercício" id="custom-exercise-name" error={error}>
        {({ id, describedBy, invalid }) => (
          <Input
            id={id}
            autoFocus
            aria-describedby={describedBy}
            aria-invalid={invalid || undefined}
            value={name}
            onChange={(event) => {
              setName(event.target.value);
            }}
            placeholder="Supino na máquina antiga"
            autoComplete="off"
          />
        )}
      </Field>

      <Optional label="Músculo principal">
        {MUSCLE_GROUPS.map((muscle) => (
          <Chip
            key={muscle}
            active={muscles.has(muscle)}
            onClick={() => {
              setMuscles(toggle(muscles, muscle));
            }}
          >
            {MUSCLE_LABELS[muscle]}
          </Chip>
        ))}
      </Optional>

      <Optional label="Equipamento">
        {EQUIPMENT.map((item) => (
          <Chip
            key={item}
            active={equipment.has(item)}
            onClick={() => {
              setEquipment(toggle(equipment, item));
            }}
          >
            {EQUIPMENT_LABELS[item]}
          </Chip>
        ))}
      </Optional>

      <div className="flex gap-2">
        <Button
          type="submit"
          pending={pending}
          disabled={name.trim().length < 3}
        >
          Criar e usar
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

function Optional({
  label,
  children,
}: {
  readonly label: string;
  readonly children: React.ReactNode;
}) {
  return (
    <div role="group" aria-label={label}>
      <p className="mb-1.5 text-[0.6875rem] font-medium tracking-wide text-ink-subtle uppercase">
        {label} <span className="normal-case">— opcional</span>
      </p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  readonly active: boolean;
  readonly onClick: () => void;
  readonly children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "h-7 rounded-full border px-2.5 text-xs transition-colors duration-150 ease-out",
        active
          ? "border-accent bg-accent text-accent-ink"
          : "border-line bg-surface text-ink-muted hover:border-line-strong hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}
