"use client";

import { CalendarDays, Copy } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useState } from "react";

import { Badge } from "@/design-system/components/badge";
import { Card } from "@/design-system/components/card";
import { noticeClasses } from "@/design-system/components/notice";

import { useOptionalPrescribedPlanRepository } from "../data/prescribed-plan-repository-context";

import { dietMacros } from "../services/diet-macros";
import { planDays, WEEKDAY_SHORT_LABELS, WEEKDAYS } from "../services/diet-schedule";
import { isUpdated, planAsDiet } from "../services/prescribed-plan";
import type { Diet, Weekday } from "../types/diet";
import type { PrescribedPlan } from "../types/prescribed-plan";
import { MacroSummary } from "./macro-summary";
import { PlanChangesNotice } from "./plan-changes-notice";
import { WeekdayPicker } from "./weekday-picker";

const DATE = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" });

/**
 * "Da sua nutricionista" em Dietas (estudo do paciente aprovado em
 * 30/09/2026): o plano fica separado das dietas da pessoa, com a etiqueta
 * "Profissional", e abre só para leitura. Para mudar algo, "Fazer uma cópia",
 * que vira uma dieta dela.
 */
export function PrescribedPlansSection({
  plans,
  diets,
  onCopy,
  onClaimDays,
}: {
  readonly plans: readonly PrescribedPlan[];
  /** As dietas da pessoa: nos dias delas vale a dieta, não o plano (`planDays`). */
  readonly diets: readonly Diet[];
  readonly onCopy: (diet: Diet) => void;
  /** Tira das dietas da pessoa os dias que ela acabou de dar ao plano. */
  readonly onClaimDays: (planId: string, weekdays: readonly Weekday[]) => Promise<void>;
}) {
  const repository = useOptionalPrescribedPlanRepository();
  const [scheduling, setScheduling] = useState<PrescribedPlan | null>(null);
  const [error, setError] = useState(false);

  return (
    <section aria-labelledby="planos-recebidos" className="space-y-2">
      <h2 id="planos-recebidos" className="text-xs font-medium tracking-wide text-ink-subtle uppercase">
        Da sua nutricionista
      </h2>
      {error && (
        <p role="alert" className={noticeClasses()}>
          Não foi possível mudar os dias do plano. Confira a conexão e tente de novo.
        </p>
      )}
      <ul className="space-y-2">
        {plans.map((plan) => (
          <PlanRow
            key={plan.id}
            plan={plan}
            days={planDays(plan, diets)}
            onCopy={onCopy}
            onSchedule={() => {
              setScheduling(plan);
            }}
            onSeen={() => {
              void repository?.then((repo) => repo.markSeen(plan.id, plan.version)).catch(() => undefined);
            }}
          />
        ))}
      </ul>
      {repository !== null && (
        <WeekdayPicker
          open={scheduling !== null}
          dietName={scheduling?.name ?? ""}
          selected={scheduling === null ? [] : planDays(scheduling, diets)}
          onSave={(weekdays) => {
            if (scheduling === null) return;
            const planId = scheduling.id;
            // Na ordem da semana, não na ordem em que foram tocados.
            const days = WEEKDAYS.filter((day) => weekdays.includes(day));
            setError(false);
            // O servidor primeiro: se falhar, as dietas da pessoa ficam como estão.
            void repository
              .then((repo) => repo.setWeekdays(planId, days))
              .then(() => onClaimDays(planId, days))
              .catch(() => {
                setError(true);
              });
          }}
          onClose={() => {
            setScheduling(null);
          }}
        />
      )}
    </section>
  );
}

function describeDays(days: readonly Weekday[]): string {
  if (days.length === WEEKDAYS.length) return "Todos os dias";
  if (days.length === 0) return "Nenhum dia";
  return days.map((day) => WEEKDAY_SHORT_LABELS[day]).join(", ");
}

function PlanRow({
  plan,
  days,
  onCopy,
  onSchedule,
  onSeen,
}: {
  readonly plan: PrescribedPlan;
  readonly days: readonly Weekday[];
  readonly onCopy: (diet: Diet) => void;
  readonly onSchedule: () => void;
  readonly onSeen: () => void;
}) {
  const diet = planAsDiet(plan);
  const meals = plan.meals.length;

  return (
    <li>
      <Card padded={false} className="transition-colors duration-150 ease-out hover:border-line-strong">
        <Link href={`/dietas/plano/${plan.id}` as Route} className="flex flex-col gap-2 p-4 pb-3 sm:flex-row sm:items-center sm:gap-4">
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-2">
              <span className="min-w-0 font-medium break-words text-ink">{plan.name}</span>
              <Badge state="concluido">Profissional</Badge>
              {isUpdated(plan) && <Badge state="atencao">Atualizado</Badge>}
            </p>
            <p className="mt-0.5 text-xs break-words text-ink-subtle">
              {plan.professionalName} · versão {plan.version}, {DATE.format(new Date(plan.publishedAt))} · {meals}{" "}
              {meals === 1 ? "refeição" : "refeições"}
            </p>
          </div>
          <div className="shrink-0">
            <MacroSummary macros={dietMacros(diet)} />
          </div>
        </Link>
        {isUpdated(plan) && <PlanChangesNotice plan={plan} onSeen={onSeen} />}
        <div className="flex flex-wrap items-center gap-x-2 border-t border-line px-2 py-1">
          <button
            type="button"
            onClick={onSchedule}
            aria-label={`Dias do plano: ${describeDays(days)}`}
            className="flex min-h-11 items-center gap-1.5 rounded-md px-2 text-sm text-ink-muted transition-colors duration-150 ease-out hover:bg-muted hover:text-ink"
          >
            <CalendarDays aria-hidden className="size-4 shrink-0" />
            {describeDays(days)}
          </button>
          <button
            type="button"
            onClick={() => {
              onCopy(diet);
            }}
            className="flex min-h-11 items-center gap-1.5 rounded-md px-2 text-sm text-ink-muted transition-colors duration-150 ease-out hover:bg-muted hover:text-ink"
          >
            <Copy aria-hidden className="size-4 shrink-0" />
            Fazer uma cópia
          </button>
        </div>
      </Card>
    </li>
  );
}
