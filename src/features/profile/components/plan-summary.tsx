import { formatDecimal } from "@/core/format/decimal";
import type { NutritionPlan, NutritionProfile, PlanResult } from "@/core/nutrition";
import { Card } from "@/design-system/components/card";
import { Notice } from "@/design-system/components/notice";
import { MACRO_CODING } from "@/design-system/macros";

/**
 * What the engine decided, and why.
 *
 * BMR and TDEE are shown alongside the target because a number with no
 * derivation is a number nobody can sanity-check. The advisories are shown for
 * the same reason: the engine changed what was asked for, and hiding that
 * would make it feel arbitrary.
 */
export function PlanSummary({
  result,
  goal,
}: {
  readonly result: PlanResult;
  readonly goal: NutritionProfile["goal"];
}) {
  if (!result.ok) {
    return (
      <Notice
        tone="danger"
        title="Não é possível montar uma meta segura com esses dados."
      >
        <ul className="mt-2 space-y-1.5 text-sm text-ink-muted">
          {result.violations.map((violation) => (
            <li key={violation.code}>{violation.message}</li>
          ))}
        </ul>
      </Notice>
    );
  }

  return <Plan plan={result.plan} goal={goal} />;
}

function Plan({
  plan,
  goal,
}: {
  readonly plan: NutritionPlan;
  readonly goal: NutritionProfile["goal"];
}) {
  const balance = plan.energyBalanceKcal;
  // The engine applies a safety floor before it applies what was asked for —
  // correctly. Someone who requested a cut and got a surplus, or a bulk and
  // got a deficit, needs to be told that in those words, not left to notice
  // it from a signed number two sections down.
  const mismatch =
    (goal === "cut" && balance >= 0) || (goal === "bulk" && balance <= 0);
  return (
    <div className="space-y-4">
      {/* The whole point of filling in the profile: the number the rest of the
          screen is inputs for. */}
      <Card tone="hero">
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-medium tabular-nums text-ink">
            {formatDecimal(plan.targets.kcal)}
          </span>
          <span className="text-sm text-ink-subtle">kcal por dia</span>
        </div>

        <dl className="mt-4 grid grid-cols-3 gap-4 border-t border-line pt-4">
          {MACRO_CODING.map(({ key, long, text }) => (
            <div key={key}>
              <dd className={`text-xl tabular-nums ${text}`}>
                {formatDecimal(plan.targets[key])}
                <span className="ml-0.5 text-xs text-ink-subtle">g</span>
              </dd>
              <dt className="mt-0.5 text-xs text-ink-subtle">{long}</dt>
            </div>
          ))}
        </dl>

        <dl className="mt-4 grid grid-cols-3 gap-4 border-t border-line pt-4 text-sm">
          <Derivation
            label="TMB"
            value={`${formatDecimal(Math.round(plan.bmrKcal))} kcal`}
          />
          <Derivation
            label="Gasto diário (TDEE)"
            value={`${formatDecimal(Math.round(plan.tdeeKcal))} kcal`}
          />
          <Derivation label="Fibra" value={`${formatDecimal(plan.fiberG)} g`} />
        </dl>

        {/* Said out loud because the number looks like the three above it and
            is not the same kind of thing. Protein, carbs and fat are targets
            the app checks against what you ate; fibre is a recommendation it
            cannot check, because no food in the catalogue carries a fibre
            value. Showing it silently beside tracked targets promises a
            measurement that never arrives.

            This used to claim "out loud" while rendering in `text-xs
            text-ink-subtle` — the faintest style the app owns. The comment was
            right about the intent and the code was doing the opposite. */}
        <Notice tone="info" className="mt-3">
          <p className="text-sm text-ink-muted">
            A fibra é uma referência (14 g por 1000 kcal) para conferir no
            rótulo: o app ainda não soma a fibra dos alimentos.
          </p>
        </Notice>

        {/* The result the whole screen exists to answer, next to the goal it
            answers for. A signed number on its own reads fine to someone who
            already knows the safety floor won — everyone else just sees
            "Superávit de 88 kcal" under a profile that asked to cut, and has
            no reason to connect the two. */}
        {(balance !== 0 || mismatch) && (
          <Notice tone={mismatch ? "warning" : "info"} className="mt-4">
            <p className="text-sm text-ink-muted">
              {mismatch && (
                <>
                  Seu objetivo era {goal === "cut" ? "perder peso" : "ganhar massa"}
                  ; com seus dados atuais, o limite seguro de ritmo não permite
                  esse resultado, a meta ficou{" "}
                  {balance === 0
                    ? "em manutenção"
                    : balance > 0
                      ? "em superávit"
                      : "em déficit"}
                  .{" "}
                </>
              )}
              {balance !== 0 && (
                <>
                  {balance < 0 ? "Déficit" : "Superávit"} de{" "}
                  <span className="tabular-nums">
                    {formatDecimal(Math.abs(balance))}
                  </span>{" "}
                  kcal por dia, cerca de{" "}
                  <span className="tabular-nums">
                    {formatDecimal(Math.abs(plan.projectedWeeklyChangeKg), 2)}
                  </span>{" "}
                  kg por semana.
                </>
              )}
            </p>
          </Notice>
        )}
      </Card>

      {/* Amber, not grey. An advisory is the engine saying it did not do what
          was asked — it clamped a deficit, floored a protein target — and in
          `bg-muted text-ink-muted` that message looked exactly like a caption.
          The one line on the screen reporting an override was the quietest
          thing on it. */}
      {plan.advisories.length > 0 && (
        <ul className="space-y-2">
          {plan.advisories.map((advisory) => (
            <li key={advisory.code}>
              <Notice tone="warning">{advisory.message}</Notice>
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
