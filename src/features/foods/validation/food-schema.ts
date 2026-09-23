import { z } from "zod";

import { FOOD_CATEGORIES } from "../types/food";

/**
 * A required number, in Portuguese.
 *
 * The `error` is the point. A blank field reaches the schema as `NaN`, and
 * without a message of our own Zod answers "Invalid input: expected number,
 * received NaN" — library text, in English, in an app that is entirely in
 * Portuguese. It is the one place the product broke character, and it broke it
 * at the worst moment: the first time somebody gets something wrong.
 */
function required(label: string, max: number, unit: string) {
  return z
    .number({ error: `Preencha ${label}.` })
    .min(0, `${label} não pode ser negativo.`)
    .max(max, `${label}: no máximo ${String(max)} ${unit} por 100 g.`);
}

/** Same bound shape as `required`, but absent is a valid answer — "not informed", never zero. See `Food.saturatedFatG`. */
function optional(label: string, max: number, unit: string) {
  return z
    .number()
    .min(0, `${label} não pode ser negativo.`)
    .max(max, `${label}: no máximo ${String(max)} ${unit} por 100 g.`)
    .optional();
}

/**
 * Bounds are physical rather than arbitrary: nothing edible exceeds 900 kcal
 * per 100 g (pure fat is 900), and no single macro can exceed 100 g in 100 g
 * of food.
 */
const macrosSchema = z.object({
  kcal: required("as calorias", 900, "kcal"),
  proteinG: required("a proteína", 100, "g"),
  carbsG: required("o carboidrato", 100, "g"),
  fatG: required("a gordura", 100, "g"),
});

/**
 * Macros are grams inside 100 g, so their sum cannot exceed 100. Water,
 * fibre and ash make up the rest, which is why the check is `<=` and not `=`.
 */
const per100gSchema = macrosSchema.refine(
  ({ proteinG, carbsG, fatG }) => proteinG + carbsG + fatG <= 100,
  {
    message:
      "Proteína, carboidrato e gordura somam mais de 100 g, impossível em 100 g de alimento.",
  },
);

const practicalUnitSchema = z.object({
  label: z
    .string()
    .trim()
    .min(1, "Dê um nome à medida, como \"1 fatia\".")
    .max(120, "Nome da medida muito longo."),
  // Physical, not a bound on the app's own MAX_GRAMS: no household measure
  // approaches that ceiling, and this schema should not have to know about it.
  grams: z
    .number({ error: "Preencha quantos gramas essa medida tem." })
    .positive("O peso da medida precisa ser maior que zero.")
    .max(10_000, "Medida: no máximo 10.000 g."),
});

/**
 * Optional here, unlike on `Food` itself: `foodRecordSchema` (backup import)
 * extends this shape, and a backup exported before liquids existed has no
 * `unit` key at all. `seedCatalogue`/`refreshFoodPracticalUnits` default a
 * missing value to `"g"` when reading the bundled catalogue, same as
 * `normalize()` does for a record already in the store.
 */
export const catalogueEntrySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(120),
  category: z.enum(FOOD_CATEGORIES),
  per100g: per100gSchema,
  unit: z.enum(["g", "ml"]).optional(),
  practicalUnit: practicalUnitSchema.optional(),
  // RM02 (roadmap 23/09/2026) — quase sempre ausente no catálogo curado
  // (genérico, não de marca); ver `Food.brand`/`Food.saturatedFatG`.
  brand: z.string().trim().max(120).optional(),
  saturatedFatG: optional("a gordura saturada", 100, "g"),
  sodiumMg: optional("o sódio", 40_000, "mg"),
  fiberG: optional("as fibras", 100, "g"),
  sugarG: optional("os açúcares", 100, "g"),
});

export type CatalogueEntry = z.infer<typeof catalogueEntrySchema>;

/**
 * What the user fills in. No `id` or timestamps: those are the factory's job,
 * not the form's.
 */
export const customFoodSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Dê um nome ao alimento.")
    .max(120, "Nome muito longo."),
  category: z.enum(FOOD_CATEGORIES),
  unit: z.enum(["g", "ml"]),
  per100g: per100gSchema,
  // Opcional, como no catálogo curado (`Food.practicalUnit`): nem todo
  // alimento tem uma porção de referência confiável, e quem cria o próprio
  // alimento pode não saber uma agora e voltar depois para editar.
  practicalUnit: practicalUnitSchema.optional(),
});

export type CustomFoodInput = z.infer<typeof customFoodSchema>;
