"use client";

import { Star, X } from "lucide-react";

import { cn } from "@/design-system/cn";

import { EQUIPMENT, EQUIPMENT_LABELS } from "../taxonomy/equipment";
import {
  MOVEMENT_PATTERNS,
  MOVEMENT_PATTERN_LABELS,
  TECHNICAL_DIFFICULTIES,
  TECHNICAL_DIFFICULTY_LABELS,
} from "../taxonomy/movement";
import { MUSCLE_GROUPS, MUSCLE_LABELS } from "../taxonomy/muscles";
import type { ExerciseFilters } from "../services/filter-exercises";

interface Props {
  readonly filters: ExerciseFilters;
  readonly activeCount: number;
  readonly onChange: (filters: ExerciseFilters) => void;
  readonly onClear: () => void;
}

/** Toggling a value in a set, without mutating the one we were given. */
function toggle<T>(set: ReadonlySet<T>, value: T): Set<T> {
  const next = new Set(set);
  if (!next.delete(value)) next.add(value);
  return next;
}

const CHIP =
  "h-7 rounded-full border px-2.5 text-xs transition-colors duration-150 ease-out";
const ON = "border-accent bg-accent text-accent-ink";
const OFF =
  "border-line bg-surface text-ink-muted hover:border-line-strong hover:text-ink";

export function ExerciseFilterBar({
  filters,
  activeCount,
  onChange,
  onClear,
}: Props) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-pressed={filters.favoritesOnly}
          onClick={() => {
            onChange({ ...filters, favoritesOnly: !filters.favoritesOnly });
          }}
          className={cn(
            CHIP,
            "inline-flex items-center gap-1.5",
            filters.favoritesOnly ? ON : OFF,
          )}
        >
          <Star
            aria-hidden
            className="size-3"
            fill={filters.favoritesOnly ? "currentColor" : "none"}
          />
          Favoritos
        </button>

        {/* Only offered when there is something to clear — a permanently
            visible "clear" on an unfiltered view is noise. */}
        {activeCount > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="inline-flex h-7 items-center gap-1 rounded-full px-2 text-xs text-ink-muted transition-colors duration-150 ease-out hover:text-ink"
          >
            <X aria-hidden className="size-3" />
            Limpar {activeCount} {activeCount === 1 ? "filtro" : "filtros"}
          </button>
        )}
      </div>

      <Group label="Músculo">
        {MUSCLE_GROUPS.map((muscle) => (
          <Chip
            key={muscle}
            active={filters.muscles.has(muscle)}
            onClick={() => {
              onChange({
                ...filters,
                muscles: toggle(filters.muscles, muscle),
              });
            }}
          >
            {MUSCLE_LABELS[muscle]}
          </Chip>
        ))}
      </Group>

      <Group label="Equipamento">
        {EQUIPMENT.map((item) => (
          <Chip
            key={item}
            active={filters.equipment.has(item)}
            onClick={() => {
              onChange({
                ...filters,
                equipment: toggle(filters.equipment, item),
              });
            }}
          >
            {EQUIPMENT_LABELS[item]}
          </Chip>
        ))}
      </Group>

      <Group label="Movimento">
        {MOVEMENT_PATTERNS.map((pattern) => (
          <Chip
            key={pattern}
            active={filters.patterns.has(pattern)}
            onClick={() => {
              onChange({
                ...filters,
                patterns: toggle(filters.patterns, pattern),
              });
            }}
          >
            {MOVEMENT_PATTERN_LABELS[pattern]}
          </Chip>
        ))}
      </Group>

      <Group label="Dificuldade técnica">
        {TECHNICAL_DIFFICULTIES.map((level) => (
          <Chip
            key={level}
            active={filters.difficulties.has(level)}
            onClick={() => {
              onChange({
                ...filters,
                difficulties: toggle(filters.difficulties, level),
              });
            }}
          >
            {TECHNICAL_DIFFICULTY_LABELS[level]}
          </Chip>
        ))}
      </Group>
    </div>
  );
}

function Group({
  label,
  children,
}: {
  readonly label: string;
  readonly children: React.ReactNode;
}) {
  return (
    <div role="group" aria-label={label}>
      <p className="mb-1.5 text-[0.6875rem] font-medium tracking-wide text-ink-subtle uppercase">
        {label}
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
      className={cn(CHIP, active ? ON : OFF)}
    >
      {children}
    </button>
  );
}
