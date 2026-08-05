import { z } from "zod";

import { FOOD_CATEGORIES } from "../types/food";

/**
 * Bounds are physical rather than arbitrary: nothing edible exceeds 900 kcal
 * per 100 g (pure fat is 900), and no single macro can exceed 100 g in 100 g
 * of food.
 */
const macrosSchema = z.object({
  kcal: z.number().min(0).max(900),
  proteinG: z.number().min(0).max(100),
  carbsG: z.number().min(0).max(100),
  fatG: z.number().min(0).max(100),
});

export const catalogueEntrySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(120),
  category: z.enum(FOOD_CATEGORIES),
  per100g: macrosSchema.refine(
    ({ proteinG, carbsG, fatG }) => proteinG + carbsG + fatG <= 100,
    { message: "Macros somam mais de 100 g em 100 g de alimento." },
  ),
});

export type CatalogueEntry = z.infer<typeof catalogueEntrySchema>;
