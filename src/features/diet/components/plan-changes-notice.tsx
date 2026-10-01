"use client";

import { Info } from "lucide-react";
import { useState } from "react";

import { formatDecimal } from "@/core/format/decimal";
import { Dialog } from "@/design-system/components/dialog";

import { comparePlans, type PlanChange } from "../services/plan-changes";
import type { PrescribedPlan } from "../types/prescribed-plan";

/**
 * Versão nova do plano, no cartão de Dietas (estudo do paciente aprovado em
 * 30/09/2026): o aviso e, num toque, o que mudou, com a nota da
 * nutricionista e a comparação com a versão anterior. Abrir conta como ter
 * visto a versão (`onSeen`), como abrir o plano.
 */
export function PlanChangesNotice({ plan, onSeen }: { readonly plan: PrescribedPlan; readonly onSeen: () => void }) {
  const [open, setOpen] = useState(false);
  const comparison = plan.previous === null ? null : comparePlans(plan.previous.meals, plan.meals);

  return (
    <div className="px-4 pb-3">
      <div className="flex items-start gap-2 rounded-lg bg-warning-surface px-3 py-2 text-sm text-ink">
        <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-warning-text" />
        <div className="min-w-0 break-words">
          <p>
            {plan.professionalName} atualizou seu plano. Os dias que você já registrou continuam como estavam.
          </p>
          <button
            type="button"
            onClick={() => {
              setOpen(true);
              onSeen();
            }}
            className="mt-1 flex min-h-11 items-center font-medium text-accent-text underline-offset-4 hover:underline"
          >
            Ver o que mudou
          </button>
        </div>
      </div>

      <Dialog
        open={open}
        title={`O que mudou na versão ${String(plan.version)}`}
        onClose={() => {
          setOpen(false);
        }}
        placement="sheet-bottom"
      >
        {plan.changeNote !== "" && (
          <p className="text-sm break-words text-ink-muted">
            Nota de {plan.professionalName}: “{plan.changeNote}”
          </p>
        )}
        {comparison === null ? (
          <p className="mt-3 text-sm text-ink-muted">A versão anterior não está neste aparelho para comparar.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line">
            {comparison.changes.length === 0 && <li className="py-2.5 text-sm text-ink-muted">Os alimentos e as quantidades não mudaram.</li>}
            {comparison.changes.map((change, index) => (
              // A comparação devolve uma lista fixa, sem reordenar: o índice é estável.
              <li key={index} className="py-2.5 text-sm break-words text-ink">
                {describe(change)}
              </li>
            ))}
            <li className="py-2.5 text-sm text-ink">
              Total do dia: {formatDecimal(comparison.kcalBefore, 0)} kcal para {formatDecimal(comparison.kcalAfter, 0)} kcal
            </li>
          </ul>
        )}
      </Dialog>
    </div>
  );
}

const amount = (grams: number, unit: string) => `${formatDecimal(grams)} ${unit}`;

function describe(change: PlanChange): string {
  switch (change.kind) {
    case "meal-added":
      return `${change.meal}: refeição nova`;
    case "meal-removed":
      return `${change.meal}: saiu do plano`;
    case "meal-renamed":
      return `${change.from} agora se chama ${change.to}`;
    case "item-added":
      return `${change.meal}: entrou ${change.item}, ${amount(change.grams, change.unit)}`;
    case "item-removed":
      return `${change.meal}: saiu ${change.item}, ${amount(change.grams, change.unit)}`;
    case "item-grams":
      return `${change.meal}: ${change.item} de ${amount(change.from, change.unit)} para ${amount(change.to, change.unit)}`;
    case "notes":
      return `${change.meal}: a orientação mudou`;
    case "options":
      return `${change.meal}: de ${String(change.from)} para ${String(change.to)} ${change.to === 1 ? "outra opção" : "outras opções"}`;
  }
}
