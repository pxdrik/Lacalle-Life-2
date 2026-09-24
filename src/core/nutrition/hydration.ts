import { round } from "./result";

/** Millilitres per kilogram of bodyweight — the same fixed reference other
 * per-kg figures in this engine use (`PROTEIN_G_PER_KG`), not a formula that
 * scales with kcal or activity. */
const ML_PER_KG = 35;

/**
 * The daily hydration target, in millilitres.
 *
 * Deliberately outside `distribution.ts`/`Macros`: water carries no kcal, and
 * mixing it into the macro engine would make "macro" mean something it
 * doesn't. Same "one function decides this number" discipline as the rest of
 * `core/nutrition` — nothing else in the app computes a water target.
 */
export function computeHydrationTargetMl(weightKg: number): number {
  return round(weightKg * ML_PER_KG);
}
