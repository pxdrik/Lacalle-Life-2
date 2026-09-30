"use client";

import { History } from "lucide-react";
import { useState } from "react";

import type { EntityId } from "@/core/domain/entity";
import { dayKey, formatShortDay } from "@/core/format/day";
import { formatDecimal } from "@/core/format/decimal";
import { Button } from "@/design-system/components/button";
import { EmptyState } from "@/design-system/components/empty-state";
import { Metric } from "@/design-system/components/metric";
import { Section } from "@/design-system/components/section";
import { Skeleton } from "@/design-system/components/skeleton";
import { TrendChart } from "@/design-system/components/trend-chart";

import { useSessionHistory } from "../hooks/use-session-history";
import { exerciseHistory, personalRecords } from "../services/history";
import type { PerformedSet } from "../types/session";

/** Quantos treinos aparecem antes de "Ver os outros". */
const FIRST_SESSIONS = 3;
/** Pontos no gráfico: os últimos treinos, o bastante para ver a direção. */
const CHART_SESSIONS = 12;

/**
 * "Seu histórico" no detalhe do exercício — roadmap 7.4 (30/09/2026), padrão
 * do Hevy, aprovado em protótipo.
 *
 * Tudo sai dos treinos já salvos, sem dado novo: série mais pesada e 1RM do
 * `personalRecords` (os mesmos números da seção Recordes da Evolução), a
 * carga da melhor série por treino no gráfico, e os últimos treinos em lista.
 * Sem treino, diz isso; nunca mostra um zero que ninguém levantou. Exercício
 * sem carga (peso do corpo, cardio) fica só com a lista.
 */
export function ExerciseHistory({ exerciseId }: { readonly exerciseId: EntityId }) {
  const state = useSessionHistory();
  const [showingAll, setShowingAll] = useState(false);

  if (state.status === "loading") {
    return <Skeleton className="h-24 rounded-lg" />;
  }

  if (state.status === "error") {
    return <p className="text-sm text-ink-subtle">{state.message}</p>;
  }

  const history = exerciseHistory(state.sessions, exerciseId);

  if (history.length === 0) {
    return (
      <Section title="Seu histórico" size="compact">
        <EmptyState
          icon={History}
          title="Você ainda não fez este exercício."
          caption="Depois do primeiro treino, suas séries aparecem aqui."
        />
      </Section>
    );
  }

  const record = personalRecords(state.sessions).find(
    (candidate) => candidate.exerciseId === exerciseId,
  );
  const points = history
    .filter((entry) => entry.topSet !== null)
    .slice(0, CHART_SESSIONS)
    .reverse()
    .map((entry) => ({
      day: dayKey(new Date(entry.performedAt)),
      value: entry.topSet!.weightKg,
    }));
  const visible = showingAll ? history : history.slice(0, FIRST_SESSIONS);
  const hidden = history.length - FIRST_SESSIONS;

  return (
    <Section title="Seu histórico" size="compact">
      <div className="space-y-4">
        {record !== undefined && (
          <div className="grid grid-cols-2 gap-3">
            <Metric
              value={`${formatDecimal(record.heaviestKg)} × ${formatDecimal(record.repsAtHeaviest)}`}
              label="Série mais pesada (kg × reps)"
            />
            <Metric
              value={formatDecimal(record.bestOneRepMax)}
              unit="kg"
              label="1RM estimado"
            />
          </div>
        )}

        {points.length >= 2 && (
          <TrendChart
            points={points}
            average={[]}
            unit="kg"
            label="Carga da melhor série por treino"
          />
        )}

        <ul className="divide-y divide-line">
          {visible.map((entry) => (
            <li
              key={entry.sessionId}
              className="flex items-baseline justify-between gap-3 py-2.5 text-sm"
            >
              <span className="shrink-0 tabular-nums text-ink">
                {formatShortDay(dayKey(new Date(entry.performedAt)))}
              </span>
              <span className="min-w-0 text-right tabular-nums text-ink-muted">
                {entry.sets.map(describeSet).join(" · ")}
              </span>
            </li>
          ))}
        </ul>

        {!showingAll && hidden > 0 && (
          <Button
            variant="secondary"
            size="sm"
            className="w-full"
            onClick={() => {
              setShowingAll(true);
            }}
          >
            {hidden === 1 ? "Ver o outro treino" : `Ver os outros ${String(hidden)} treinos`}
          </Button>
        )}
      </div>
    </Section>
  );
}

/** "60×8" (kg × reps, 30/09/2026), "12" (sem carga) ou "10 min" (cardio). */
function describeSet(set: PerformedSet): string {
  if (set.durationSeconds !== null) {
    return `${formatDecimal(Math.round((set.durationSeconds / 60) * 10) / 10)} min`;
  }
  const reps = set.reps === null ? "—" : formatDecimal(set.reps);
  return set.weightKg === null || set.weightKg <= 0
    ? reps
    : `${formatDecimal(set.weightKg)}×${reps}`;
}
