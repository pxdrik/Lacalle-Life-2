"use client";

import { useState } from "react";

import { parseDecimal } from "@/core/format/decimal";
import { Button } from "@/design-system/components/button";

import {
  MEASUREMENT_SITE_HINTS,
  MEASUREMENT_SITE_LABELS,
  MEASUREMENT_SITES,
} from "../taxonomy/measurement-sites";
import type { BodyEntry } from "../types/body-entry";

interface Props {
  readonly entry: BodyEntry;
  readonly pending: boolean;
  readonly onSubmit: (entry: BodyEntry) => void;
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
export function BodyEntryForm({ entry, pending, onSubmit, onCancel }: Props) {
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

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit({
          ...entry,
          weightKg: parseDecimal(weight),
          bodyFatPercent: parseDecimal(fat),
          notes: notes.trim(),
          measurements: Object.fromEntries(
            MEASUREMENT_SITES.map((site) => [
              site,
              parseDecimal(sites[site] ?? ""),
            ]),
          ) as BodyEntry["measurements"],
        });
      }}
      className="space-y-5"
    >
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
        className="mt-1 h-11 w-full rounded-lg border border-line bg-surface px-3 font-mono tabular-nums text-ink transition-colors duration-150 ease-out placeholder:text-ink-subtle hover:border-line-strong focus:border-line-strong"
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
