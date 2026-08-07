"use client";

import { dayKey } from "@/core/format/day";
import { Skeleton } from "@/design-system/components/skeleton";
import { Plus } from "lucide-react";
import { useState } from "react";

import { Button } from "@/design-system/components/button";
import { Card } from "@/design-system/components/card";
import { cn } from "@/design-system/cn";

import { useBodyLog } from "../hooks/use-body-log";
import {
  changeIn,
  movingAverage,
  seriesOf,
  type TrendPoint,
} from "../services/body-log";
import {
  MEASUREMENT_SITE_LABELS,
  MEASUREMENT_SITES,
  type MeasurementSite,
} from "../taxonomy/measurement-sites";
import type { BodyEntry } from "../types/body-entry";
import { BodyEntryForm } from "./body-entry-form";
import { BodyHistory } from "./body-history";
import { TrendChart } from "./trend-chart";

type Metric =
  | { readonly kind: "weight" }
  | { readonly kind: "fat" }
  | { readonly kind: "site"; readonly site: MeasurementSite };

const WEIGHT: Metric = { kind: "weight" };

function readMetric(metric: Metric): (entry: BodyEntry) => number | null {
  if (metric.kind === "weight") return (entry) => entry.weightKg;
  if (metric.kind === "fat") return (entry) => entry.bodyFatPercent;

  return (entry) => entry.measurements[metric.site];
}

function unitOf(metric: Metric): string {
  return metric.kind === "weight" ? "kg" : metric.kind === "fat" ? "%" : "cm";
}

function labelOf(metric: Metric): string {
  if (metric.kind === "weight") return "Peso";
  if (metric.kind === "fat") return "Gordura";

  return MEASUREMENT_SITE_LABELS[metric.site];
}

/**
 * The body half of "acompanhar evolução".
 *
 * Deliberately independent of the profile. The profile's weight is an *input*
 * to the calorie target; this is the *record* of what happened. Wiring the two
 * together would make the diet depend on this screen, and the rule since the
 * first commit is that a diet must never depend on anything optional.
 */
export function BodyScreen() {
  const { state, writeError, saveDay, removeDay, entryFor } = useBodyLog();
  const [metric, setMetric] = useState<Metric>(WEIGHT);
  const [editing, setEditing] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (state.status === "loading") return <BodySkeleton />;

  if (state.status === "error") {
    return (
      <div
        role="alert"
        className="rounded-xl border border-danger/30 bg-danger/5 px-6 py-8 text-center"
      >
        <p className="text-ink">Não foi possível carregar suas medidas.</p>
        <p className="mt-1.5 text-sm text-ink-muted">{state.message}</p>
      </div>
    );
  }

  const { entries } = state;
  const points = seriesOf(entries, readMetric(metric));
  const change = changeIn(points);

  // Only metrics with something recorded get a tab: offering nine empty
  // measurement charts to someone who only weighs themselves is nine dead ends.
  const candidates: readonly Metric[] = [
    WEIGHT,
    { kind: "fat" },
    ...MEASUREMENT_SITES.map<Metric>((site) => ({ kind: "site", site })),
  ];
  const available = candidates.filter(
    (candidate) =>
      candidate.kind === "weight" ||
      seriesOf(entries, readMetric(candidate)).length > 0,
  );

  return (
    <section className="space-y-4">
      <header className="flex items-end justify-between gap-4">
        <Headline change={change} unit={unitOf(metric)} label={labelOf(metric)} />

        {editing === null && (
          <Button
            size="sm"
            onClick={() => {
              setEditing(dayKey(new Date()));
            }}
          >
            <Plus aria-hidden className="size-4" />
            Registrar
          </Button>
        )}
      </header>

      {writeError !== null && (
        <p
          role="alert"
          className="rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-ink"
        >
          {writeError}
        </p>
      )}

      {editing !== null && (
        <Card>
          <BodyEntryForm
            entry={entryFor(editing)}
            pending={saving}
            takenDays={entries.map((item) => item.day)}
            onCancel={() => {
              setEditing(null);
            }}
            onSubmit={(entry, previousDay) => {
              setSaving(true);
              void saveDay(entry, previousDay).then((ok) => {
                setSaving(false);
                if (ok) setEditing(null);
              });
            }}
          />
        </Card>
      )}

      {entries.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          {available.length > 1 && (
            <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
              {available.map((candidate) => {
                const active = keyOf(candidate) === keyOf(metric);

                return (
                  <button
                    key={keyOf(candidate)}
                    type="button"
                    aria-pressed={active}
                    onClick={() => {
                      setMetric(candidate);
                    }}
                    className={cn(
                      "shrink-0 rounded-full border px-3 py-1 text-xs transition-colors duration-150 ease-out",
                      active
                        ? "border-accent bg-accent text-accent-ink"
                        : "border-line text-ink-muted hover:border-line-strong hover:text-ink",
                    )}
                  >
                    {labelOf(candidate)}
                  </button>
                );
              })}
            </div>
          )}

          {points.length === 0 ? (
            <p className="rounded-xl border border-dashed border-line px-6 py-10 text-center text-sm text-ink-subtle">
              Nenhum registro de {labelOf(metric).toLowerCase()} ainda.
            </p>
          ) : (
            <TrendChart
              points={points}
              average={points.length >= 4 ? movingAverage(points) : []}
              unit={unitOf(metric)}
              label={labelOf(metric)}
            />
          )}

          <BodyHistory
            entries={entries}
            onEdit={(day) => {
              setEditing(day);
            }}
            onRemove={(day) => void removeDay(day)}
          />
        </>
      )}
    </section>
  );
}

function keyOf(metric: Metric): string {
  return metric.kind === "site" ? `site:${metric.site}` : metric.kind;
}

/**
 * The number and which way it moved.
 *
 * The delta carries a sign and no judgement: this app does not know whether
 * someone is cutting or bulking, and colouring a loss green would be guessing
 * at a goal nobody told it.
 */
function Headline({
  change,
  unit,
  label,
}: {
  readonly change: ReturnType<typeof changeIn>;
  readonly unit: string;
  readonly label: string;
}) {
  if (change === null) {
    return (
      <div>
        <p className="text-xs text-ink-subtle">{label}</p>
        <p className="font-mono text-2xl tabular-nums text-ink-subtle">—</p>
      </div>
    );
  }

  return (
    <div>
      <p className="text-xs text-ink-subtle">{label}</p>
      <p className="font-mono text-2xl tabular-nums text-ink">
        {change.latest.value.toLocaleString("pt-BR")}
        <span className="ml-1 text-sm text-ink-subtle">{unit}</span>
      </p>
      {change.delta !== null && (
        <p className="mt-0.5 font-mono text-xs tabular-nums text-ink-muted">
          {change.delta > 0 ? "+" : ""}
          {change.delta.toLocaleString("pt-BR", {
            maximumFractionDigits: 2,
          })}{" "}
          {unit} desde a medição anterior
        </p>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-xl border border-dashed border-line px-6 py-12 text-center">
      <p className="text-ink">Nenhuma medição ainda.</p>
      <p className="mx-auto mt-1.5 max-w-sm text-sm text-ink-subtle">
        Um peso por semana já mostra a tendência. As medidas são opcionais e
        podem entrar quando você quiser.
      </p>
    </div>
  );
}

function BodySkeleton() {
  return (
    <div aria-hidden className="space-y-4">
      <Skeleton className="h-12 w-40" />
      <Skeleton className="h-48 w-full rounded-xl" />
      <Skeleton className="h-32 w-full rounded-xl" />
    </div>
  );
}

export type { TrendPoint };
