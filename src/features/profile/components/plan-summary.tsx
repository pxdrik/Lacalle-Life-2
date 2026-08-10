import { formatDecimal } from "@/core/format/decimal";
import type { NutritionPlan, PlanResult } from "@/core/nutrition";
import { Card } from "@/design-system/components/card";

const FIGURES = [
  { key: "proteinG", label: "Proteína", color: "text-protein" },
  { key: "carbsG", label: "Carboidrato", color: "text-carbs" },
  { key: "fatG", label: "Gordura", color: "text-fat" },
] as const;

/**
 * What the engine decided, and why.
 *
 * BMR and TDEE are shown alongside the target because a number with no
 * derivation is a number nobody can sanity-check. The advisories are shown for
 * the same reason: the engine changed what was asked for, and hiding that
 * would make it feel arbitrary.
 */
export function PlanSummary({ result }: { readonly result: PlanResult }) {
  if (!result.ok) {
    return (
      <div
        role="alert"
        className="rounded-xl border border-danger/30 bg-danger/5 p-5"
      >
        <p className="font-medium text-ink">
          Não é possível montar uma meta segura com esses dados.
        </p>
        <ul className="mt-3 space-y-1.5 text-sm text-ink-muted">
          {result.violations.map((violation) => (
            <li key={violation.code}>{violation.message}</li>
          ))}
        </ul>
      </div>
    );
  }

  return <Plan plan={result.plan} />;
}

function Plan({ plan }: { readonly plan: NutritionPlan }) {
  return (
    <div className="space-y-4">
      <Card>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-medium tabular-nums text-ink">
            {formatDecimal(plan.targets.kcal)}
          </span>
          <span className="text-sm text-ink-subtle">kcal por dia</span>
        </div>

        <dl className="mt-4 grid grid-cols-3 gap-4 border-t border-line pt-4">
          {FIGURES.map(({ key, label, color }) => (
            <div key={key}>
              <dd className={`text-xl tabular-nums ${color}`}>
                {formatDecimal(plan.targets[key])}
                <span className="ml-0.5 text-xs text-ink-subtle">g</span>
              </dd>
              <dt className="mt-0.5 text-xs text-ink-subtle">{label}</dt>
            </div>
          ))}
        </dl>

        <dl className="mt-4 grid grid-cols-3 gap-4 border-t border-line pt-4 text-sm">
          <Derivation
            label="TMB"
            value={`${formatDecimal(Math.round(plan.bmrKcal))} kcal`}
          />
          <Derivation
            label="TDEE"
            value={`${formatDecimal(Math.round(plan.tdeeKcal))} kcal`}
          />
          <Derivation label="Fibra" value={`${formatDecimal(plan.fiberG)} g`} />
        </dl>

        {/* Said out loud because the number looks like the three above it and
            is not the same kind of thing. Protein, carbs and fat are targets
            the app checks against what you ate; fibre is a recommendation it
            cannot check, because no food in the catalogue carries a fibre
            value. Showing it silently beside tracked targets promises a
            measurement that never arrives. */}
        <p className="mt-2 text-xs text-ink-subtle">
          A fibra é uma referência (14 g por 1000 kcal) para conferir no rótulo
          — o app ainda não soma a fibra dos alimentos.
        </p>

        {plan.energyBalanceKcal !== 0 && (
          <p className="mt-4 border-t border-line pt-4 text-sm text-ink-muted">
            {plan.energyBalanceKcal < 0 ? "Déficit" : "Superávit"} de{" "}
            <span className="tabular-nums">
              {formatDecimal(Math.abs(plan.energyBalanceKcal))}
            </span>{" "}
            kcal por dia — cerca de{" "}
            <span className="tabular-nums">
              {formatDecimal(Math.abs(plan.projectedWeeklyChangeKg), 2)}
            </span>{" "}
            kg por semana.
          </p>
        )}
      </Card>

      {plan.advisories.length > 0 && (
        <ul className="space-y-2">
          {plan.advisories.map((advisory) => (
            <li
              key={advisory.code}
              className="rounded-lg border border-line bg-muted px-4 py-3 text-sm text-ink-muted"
            >
              {advisory.message}
            </li>
          ))}
        </ul>
      )}

      <p className="text-xs text-ink-subtle">
        Estimativas para orientar seu planejamento. Não substituem avaliação de
        nutricionista ou médico.
      </p>
    </div>
  );
}

function Derivation({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string;
}) {
  return (
    <div>
      <dd className="tabular-nums text-ink-muted">{value}</dd>
      <dt className="mt-0.5 text-xs text-ink-subtle">{label}</dt>
    </div>
  );
}
