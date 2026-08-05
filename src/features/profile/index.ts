/**
 * What the profile feature offers to the rest of the app.
 *
 * Only the targets. No other feature needs to know a profile exists, which is
 * what keeps "montar dieta" independent of "ter perfil preenchido".
 */
export { useNutritionTargets } from "./hooks/use-nutrition-targets";
