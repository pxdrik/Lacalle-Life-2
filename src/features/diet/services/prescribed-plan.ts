import type { Diet } from "../types/diet";
import type { PrescribedPlan } from "../types/prescribed-plan";

/**
 * O plano no formato de dieta, para o que o app já sabe fazer com uma:
 * somar (`dietMacros`) e copiar (`duplicateDiet`). Sem dias da semana: os
 * dias do plano são da nutricionista e não viajam para a cópia, que vira uma
 * dieta da pessoa, com os dias que ela quiser.
 */
export function planAsDiet(plan: PrescribedPlan): Diet {
  return {
    id: plan.id,
    name: plan.name,
    meals: plan.meals,
    weekdays: [],
    createdAt: plan.createdAt,
    updatedAt: plan.updatedAt,
  };
}

/** Versão nova que o paciente ainda não abriu (nunca na primeira que chega). */
export function isUpdated(plan: PrescribedPlan): boolean {
  return plan.seenVersion > 0 && plan.seenVersion < plan.version;
}
