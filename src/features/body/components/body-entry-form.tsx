"use client";

import { useState } from "react";

import { dayKey, formatDay, isFutureDay } from "@/core/format/day";
import { parseDecimal } from "@/core/format/decimal";
import { Button } from "@/design-system/components/button";

import { moveEntryToDay } from "../services/body-log";

import {
  MEASUREMENT_SITE_HINTS,
  MEASUREMENT_SITE_LABELS,
  MEASUREMENT_SITES,
} from "../taxonomy/measurement-sites";
import type { BodyEntry } from "../types/body-entry";

interface Props {
  readonly entry: BodyEntry;
  readonly pending: boolean;
  /** Days that already hold a record, so the form can warn before replacing. */
  readonly takenDays: readonly string[];
  readonly onSubmit: (entry: BodyEntry, previousDay: string) => void;
  readonly onCancel: () => void;
}

/**
 * One day's numbers.
 *
 * Weight is alone at the top and the measurements are folded away, because the
 * overwhelmingly common visit is stepping off a scale and typing one number.
 * Making that person scroll past nine tape measurements would be charging
 * everybody for what a few people do monthly.
 *
 * Every field may be left blank. Blank means not measured, and a blank day is
 * deleted rather than stored — see `useBodyLog`.
 */
export function BodyEntryForm({
  entry,
  pending,
  takenDays,
  onSubmit,
  onCancel,
}: Props) {
  const [day, setDay] = useState(entry.day);
  const [weight, setWeight] = useState(text(entry.weightKg));
  const [fat, setFat] = useState(text(entry.bodyFatPercent));
  const [notes, setNotes] = useState(entry.notes);
  const [sites, setSites] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      MEASUREMENT_SITES.map((site) => [site, text(entry.measurements[site])]),
    ),
  );
  const [showSites, setShowSites] = useState(() =>
    MEASUREMENT_SITES.some((site) => entry.measurements[site] !== null),
  );

  const future = isFutureDay(day);
  // Only a warning, never a block: replacing a day is a legitimate correction,
  // and the person is better placed than the app to know that.
  const replacing = day !== entry.day && takenDays.includes(day);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (future) return;

        onSubmit(
          {
            ...moveEntryToDay(entry, day),
            weightKg: parseDecimal(weight),
            bodyFatPercent: parseDecimal(fat),
            notes: notes.trim(),
            measurements: Object.fromEntries(
              MEASUREMENT_SITES.map((site) => [
                site,
                parseDecimal(sites[site] ?? ""),
              ]),
            ) as BodyEntry["measurements"],
          },
          entry.day,
        );
      }}
      className="space-y-5"
    >
      {/* The date leads, because the reason this field exists is somebody
          recording a weigh-in they took days ago. */}
      <label className="block">
        <span className="text-xs text-ink-subtle">Data</span>
        <input
          type="date"
          value={day}
          max={dayKey(new Date())}
          onChange={(event) => {
            setDay(event.target.value);
          }}
          aria-invalid={future || undefined}
          className="mt-1 h-(--control-h) rounded-lg border border-line bg-surface px-3 tabular-nums text-ink transition-colors duration-150 ease-out hover:border-line-strong"
        />
      </label>

      {future && (
        <p role="alert" className="text-xs text-danger">
          Essa data ainda não chegou.
        </p>
      )}

      {replacing && (
        <p className="text-xs text-ink-muted">
          Já existe um registro em {formatDay(day)}. Salvar substitui o que está
          lá.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Number
          label="Peso"
          unit="kg"
          value={weight}
          onChange={setWeight}
          autoFocus
        />
        <Number label="Gordura" unit="%" value={fat} onChange={setFat} />
      </div>

      <div>
        <button
          type="button"
          aria-expanded={showSites}
          onClick={() => {
            setShowSites((open) => !open);
          }}
          className="text-sm text-ink-muted underline underline-offset-4 hover:text-ink"
        >
          {showSites ? "Ocultar medidas" : "Adicionar medidas"}
        </button>

        {showSites && (
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {MEASUREMENT_SITES.map((site) => (
              <Number
                key={site}
                label={MEASUREMENT_SITE_LABELS[site]}
                hint={MEASUREMENT_SITE_HINTS[site]}
                unit="cm"
                value={sites[site] ?? ""}
                onChange={(value) => {
                  setSites((current) => ({ ...current, [site]: value }));
                }}
              />
            ))}
          </div>
        )}
      </div>

      <label className="block">
        <span className="text-xs text-ink-subtle">Observações</span>
        <input
          type="text"
          value={notes}
          onChange={(event) => {
            setNotes(event.target.value);
          }}
          placeholder="Em jejum, após o treino…"
          className="mt-1 h-11 w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink transition-colors duration-150 ease-out placeholder:text-ink-subtle hover:border-line-strong focus:border-line-strong"
        />
      </label>

      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Salvando…" : "Salvar"}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

function Number({
  label,
  unit,
  hint,
  value,
  onChange,
  autoFocus,
}: {
  readonly label: string;
  readonly unit: string;
  readonly hint?: string | undefined;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly autoFocus?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-xs text-ink-subtle">
        {label} <span className="text-line-strong">({unit})</span>
      </span>
      <input
        type="text"
        inputMode="decimal"
        value={value}
        // The form only opens because someone asked to log a weight, and this
        // is the field they came to fill in.
        autoFocus={autoFocus === true}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        placeholder="—"
        className="mt-1 h-11 w-full rounded-lg border border-line bg-surface px-3 tabular-nums text-ink transition-colors duration-150 ease-out placeholder:text-ink-subtle hover:border-line-strong focus:border-line-strong"
      />
      {hint !== undefined && (
        <span className="mt-0.5 block text-[0.625rem] text-ink-subtle">
          {hint}
        </span>
      )}
    </label>
  );
}

function text(value: number | null): string {
  return value === null ? "" : String(value).replace(".", ",");
}
