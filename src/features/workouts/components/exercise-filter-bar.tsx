"use client";

import { ChevronDown, Star, X } from "lucide-react";
import { useState } from "react";

import { cn } from "@/design-system/cn";

import { EQUIPMENT, EQUIPMENT_LABELS } from "../taxonomy/equipment";
import {
  MOVEMENT_PATTERNS,
  MOVEMENT_PATTERN_LABELS,
  TECHNICAL_DIFFICULTIES,
  TECHNICAL_DIFFICULTY_LABELS,
} from "../taxonomy/movement";
import {
  MUSCLE_GROUPS,
  MUSCLE_LABELS,
  MUSCLE_REGION,
  REGION_LABELS,
  type MuscleGroup,
  type Region,
} from "../taxonomy/muscles";
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

/**
 * Os 19 músculos em 6 regiões (roadmap 10.2, 30/09/2026), pelo mesmo mapa que
 * organiza o catálogo (`MUSCLE_REGION`). Cardio fica de fora: não é músculo,
 * é um movimento, e tem o filtro dele em "Movimento".
 */
const MUSCLE_REGIONS: readonly { readonly region: Region; readonly muscles: readonly MuscleGroup[] }[] = (
  ["peito", "costas", "ombros", "bracos", "core", "pernas"] as const
).map((region) => ({
  region,
  muscles: MUSCLE_GROUPS.filter((muscle) => MUSCLE_REGION[muscle] === region),
}));

const CHIP =
  "h-7 touch-44 rounded-full border px-2.5 text-xs transition-colors duration-150 ease-out";
const ON = "border-accent bg-accent text-accent-ink";
const OFF =
  "border-line bg-surface text-ink-muted hover:border-line-strong hover:text-ink";

export function ExerciseFilterBar({
  filters,
  activeCount,
  onChange,
  onClear,
}: Props) {
  // A região aberta, mostrando os músculos dela. Só uma por vez: abrir todas
  // traria de volta a parede de 19 pílulas que isto existe para evitar.
  const [openRegion, setOpenRegion] = useState<Region | null>(null);
  const open = MUSCLE_REGIONS.find((item) => item.region === openRegion);

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
        {MUSCLE_REGIONS.map(({ region, muscles }) => {
          const chosen = muscles.filter((muscle) => filters.muscles.has(muscle)).length;

          // Região de um músculo só (peito): a pílula escolhe direto, não
          // há o que abrir.
          if (muscles.length === 1) {
            const only = muscles[0]!;
            return (
              <Chip
                key={region}
                active={filters.muscles.has(only)}
                onClick={() => {
                  onChange({ ...filters, muscles: toggle(filters.muscles, only) });
                }}
              >
                {REGION_LABELS[region]}
              </Chip>
            );
          }

          const expanded = openRegion === region;
          return (
            <button
              key={region}
              type="button"
              aria-expanded={expanded}
              onClick={() => {
                setOpenRegion(expanded ? null : region);
              }}
              className={cn(CHIP, "inline-flex items-center gap-1", chosen > 0 ? ON : OFF)}
            >
              {REGION_LABELS[region]}
              {chosen > 0 && <span className="tabular-nums">{chosen}</span>}
              <ChevronDown
                aria-hidden
                className={cn("size-3 transition-transform duration-150 ease-out", expanded && "rotate-180")}
              />
            </button>
          );
        })}

        {open !== undefined && (
          <div
            role="group"
            aria-label={`Músculos de ${REGION_LABELS[open.region]}`}
            className="flex basis-full flex-wrap gap-1.5 rounded-lg bg-muted p-2"
          >
            <Chip
              active={open.muscles.every((muscle) => filters.muscles.has(muscle))}
              onClick={() => {
                const all = open.muscles.every((muscle) => filters.muscles.has(muscle));
                const next = new Set(filters.muscles);
                for (const muscle of open.muscles) {
                  if (all) next.delete(muscle);
                  else next.add(muscle);
                }
                onChange({ ...filters, muscles: next });
              }}
            >
              Todos
            </Chip>
            {open.muscles.map((muscle) => (
              <Chip
                key={muscle}
                active={filters.muscles.has(muscle)}
                onClick={() => {
                  onChange({ ...filters, muscles: toggle(filters.muscles, muscle) });
                }}
              >
                {MUSCLE_LABELS[muscle]}
              </Chip>
            ))}
          </div>
        )}
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
