"use client";

import { useId, useState } from "react";

import { dayKey, formatDay, isFutureDay } from "@/core/format/day";
import { parseDecimal } from "@/core/format/decimal";
import { Button } from "@/design-system/components/button";

import { moveEntryToDay } from "../services/body-log";
import { bodyEntrySchema } from "../validation/body-schema";

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
  // Keyed by the schema's own path — `weightKg`, `measurements.waist` — so the
  // field that reports a problem is the field the schema named.
  const [issues, setIssues] = useState<Readonly<Record<string, string>>>({});

  const future = isFutureDay(day);
  // Only a warning, never a block: replacing a day is a legitimate correction,
  // and the person is better placed than the app to know that.
  const replacing = day !== entry.day && takenDays.includes(day);

  /**
   * Drops the stale message for one field.
   *
   * Without it the form goes on saying "O peso fica entre 30 e 300 kg" beside
   * a weight the person already corrected — the app contradicting what is on
   * screen, at the exact moment it asked for the correction.
   */
  function clearIssue(field: string) {
    setIssues((current) => {
      if (current[field] === undefined) return current;

      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (future) return;

        const parsed = bodyEntrySchema.safeParse({
          weightKg: parseDecimal(weight),
          bodyFatPercent: parseDecimal(fat),
          measurements: Object.fromEntries(
            MEASUREMENT_SITES.map((site) => [
              site,
              parseDecimal(sites[site] ?? ""),
            ]),
          ),
        });

        if (!parsed.success) {
          const found: Record<string, string> = {};
          for (const issue of parsed.error.issues) {
            found[issue.path.join(".")] ??= issue.message;
          }
          setIssues(found);

          // A folded panel with the offending number inside it would refuse
          // to submit and show nothing — the form silently disagreeing with
          // itself. If the problem is down there, open it.
          if (Object.keys(found).some((key) => key.startsWith("measurements"))) {
            setShowSites(true);
          }
          return;
        }

        setIssues({});
        onSubmit(
          {
            ...moveEntryToDay(entry, day),
            weightKg: parsed.data.weightKg,
            bodyFatPercent: parsed.data.bodyFatPercent,
            notes: notes.trim(),
            measurements: parsed.data.measurements as BodyEntry["measurements"],
          },
          entry.day,
        );
      }}
      noValidate
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
          className="mt-1 h-(--control-h) rounded-md border border-line bg-surface px-3 tabular-nums text-ink transition-colors duration-150 ease-out hover:border-line-strong"
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
          error={issues["weightKg"]}
          onChange={(value) => {
            setWeight(value);
            clearIssue("weightKg");
          }}
          autoFocus
        />
        <Number
          label="Gordura"
          unit="%"
          value={fat}
          error={issues["bodyFatPercent"]}
          onChange={(value) => {
            setFat(value);
            clearIssue("bodyFatPercent");
          }}
        />
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
                error={issues[`measurements.${site}`]}
                onChange={(value) => {
                  setSites((current) => ({ ...current, [site]: value }));
                  clearIssue(`measurements.${site}`);
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
          className="mt-1 h-11 w-full rounded-md border border-line bg-surface px-3 text-sm text-ink transition-colors duration-150 ease-out placeholder:text-ink-subtle hover:border-line-strong focus:border-line-strong"
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

/**
 * The message replaces the hint rather than stacking under it, which is the
 * rule `Field` already sets in the design system: two lines of guidance, one a
 * correction and one advice, read as noise exactly when somebody is stuck.
 *
 * It is wired through `aria-describedby` and not merely printed. A message
 * that is visible and unannounced makes the field *look* accessible while a
 * screen reader reads the label, hits the invalid value and says nothing about
 * why.
 */
function Number({
  label,
  unit,
  hint,
  value,
  error,
  onChange,
  autoFocus,
}: {
  readonly label: string;
  readonly unit: string;
  readonly hint?: string | undefined;
  readonly value: string;
  readonly error?: string | undefined;
  readonly onChange: (value: string) => void;
  readonly autoFocus?: boolean;
}) {
  const messageId = useId();
  const message = error ?? hint;

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
        aria-invalid={error !== undefined || undefined}
        aria-describedby={message === undefined ? undefined : messageId}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        placeholder="—"
        // Mesma anatomia do `Input` do design system — pág. 26: 44 px, raio 12,
        // borda Gray 300, padding 14, e o foco levando a borda para o acento.
        // Continua sendo um input próprio porque este campo é um rascunho
        // numérico com estado seu; o que ele não pode é *parecer* outro campo.
        className="mt-1 h-(--input-h) w-full rounded-md border border-line-strong bg-surface px-(--input-px) tabular-nums text-ink transition-colors duration-(--duration-micro) ease-out placeholder:text-ink-subtle hover:border-ink-subtle focus:border-accent aria-[invalid=true]:border-danger"
      />
      {message !== undefined && (
        <span
          id={messageId}
          className={
            error === undefined
              ? "mt-1 block text-xs text-ink-subtle"
              : // `danger-text` e não `danger`: o vermelho de borda mede
                // 4,41:1 sobre a superfície de erro, abaixo do que texto pede.
                "mt-1 block text-xs text-danger-text"
          }
        >
          {message}
        </span>
      )}
    </label>
  );
}

function text(value: number | null): string {
  return value === null ? "" : String(value).replace(".", ",");
}
