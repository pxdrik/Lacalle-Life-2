"use client";

import { CalendarDays, Copy } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";

import { Badge } from "@/design-system/components/badge";
import { Card } from "@/design-system/components/card";

import { useOptionalPrescribedPlanRepository } from "../data/prescribed-plan-repository-context";

import { dietMacros } from "../services/diet-macros";
import { describeWeekdays } from "../services/diet-schedule";
import { isUpdated, planAsDiet } from "../services/prescribed-plan";
import type { Diet } from "../types/diet";
import type { PrescribedPlan } from "../types/prescribed-plan";
import { MacroSummary } from "./macro-summary";
import { PlanChangesNotice } from "./plan-changes-notice";

const DATE = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" });

/**
 * "Do seu treinador" em Dietas (estudo do paciente aprovado em
 * 30/09/2026): o plano fica separado das dietas da pessoa, com a etiqueta
 * "Profissional", e abre só para leitura. Para mudar algo, "Fazer uma cópia",
 * que vira uma dieta dela.
 *
 * Os dias do plano são da nutricionista (Etapa 5e) e aparecem aqui só para
 * leitura. Num dia que também é de uma dieta da pessoa, ela escolhe no Diário.
 */
export function PrescribedPlansSection({
  plans,
  onCopy,
}: {
  readonly plans: readonly PrescribedPlan[];
  readonly onCopy: (diet: Diet) => void;
}) {
  const repository = useOptionalPrescribedPlanRepository();

  return (
    <section aria-labelledby="planos-recebidos" className="space-y-2">
      <h2 id="planos-recebidos" className="text-xs font-medium tracking-wide text-ink-subtle uppercase">
        Do seu treinador
      </h2>
      <ul className="space-y-2">
        {plans.map((plan) => (
          <PlanRow
            key={plan.id}
            plan={plan}
            onCopy={onCopy}
            onSeen={() => {
              void repository?.then((repo) => repo.markSeen(plan.id, plan.version)).catch(() => undefined);
            }}
          />
        ))}
      </ul>
    </section>
  );
}

function PlanRow({
  plan,
  onCopy,
  onSeen,
}: {
  readonly plan: PrescribedPlan;
  readonly onCopy: (diet: Diet) => void;
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
          <p className="flex min-h-11 items-center gap-1.5 px-2 text-sm text-ink-muted">
            <CalendarDays aria-hidden className="size-4 shrink-0" />
            <span className="sr-only">Dias do plano:</span>
            {describeWeekdays(plan.weekdays)}
          </p>
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
