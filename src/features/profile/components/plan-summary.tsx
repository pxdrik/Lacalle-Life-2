import type { NutritionPlan, PlanResult } from "@/core/nutrition";

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
      <div className="rounded-xl border border-line bg-surface p-5">
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-3xl font-medium tabular-nums text-ink">
            {plan.targets.kcal}
          </span>
          <span className="text-sm text-ink-subtle">kcal por dia</span>
        </div>

        <dl className="mt-4 grid grid-cols-3 gap-4 border-t border-line pt-4">
          {FIGURES.map(({ key, label, color }) => (
            <div key={key}>
              <dd className={`font-mono text-xl tabular-nums ${color}`}>
                {plan.targets[key]}
                <span className="ml-0.5 text-xs text-ink-subtle">g</span>
              </dd>
              <dt className="mt-0.5 text-xs text-ink-subtle">{label}</dt>
            </div>
          ))}
        </dl>

        <dl className="mt-4 grid grid-cols-3 gap-4 border-t border-line pt-4 text-sm">
          <Derivation label="TMB" value={`${Math.round(plan.bmrKcal)} kcal`} />
          <Derivation label="TDEE" value={`${Math.round(plan.tdeeKcal)} kcal`} />
          <Derivation label="Fibra" value={`${plan.fiberG} g`} />
        </dl>

        {plan.energyBalanceKcal !== 0 && (
          <p className="mt-4 border-t border-line pt-4 text-sm text-ink-muted">
            {plan.energyBalanceKcal < 0 ? "Déficit" : "Superávit"} de{" "}
            <span className="font-mono tabular-nums">
              {Math.abs(plan.energyBalanceKcal)}
            </span>{" "}
            kcal por dia — cerca de{" "}
            <span className="font-mono tabular-nums">
              {Math.abs(plan.projectedWeeklyChangeKg).toFixed(2)}
            </span>{" "}
            kg por semana.
          </p>
        )}
      </div>

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
      <dd className="font-mono tabular-nums text-ink-muted">{value}</dd>
      <dt className="mt-0.5 text-xs text-ink-subtle">{label}</dt>
    </div>
  );
}
