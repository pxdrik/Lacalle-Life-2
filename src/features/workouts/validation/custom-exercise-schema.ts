import { z } from "zod";

import { EQUIPMENT } from "../taxonomy/equipment";
import { MUSCLE_GROUPS } from "../taxonomy/muscles";

/**
 * What the user fills in to create their own exercise.
 *
 * **Only the name is required.** If the movement you do is not in the
 * catalogue, you must not be blocked from logging it — and demanding a muscle
 * group and an equipment type before you can write "Supino na máquina velha
 * da academia" is exactly that kind of block.
 *
 * Everything else is offered because it makes the filters work, never because
 * it is needed. An exercise created with a name alone is unclassified, which
 * is a state the model already has a place for.
 */
export const customExerciseSchema = z.object({
  name: z
    .string()
    .trim()
    .min(3, "Dê um nome com pelo menos 3 letras.")
    .max(80, "Nome muito longo."),

  primaryMuscles: z.array(z.enum(MUSCLE_GROUPS)).default([]),
  equipment: z.array(z.enum(EQUIPMENT)).default([]),
});

export type CustomExerciseInput = z.infer<typeof customExerciseSchema>;
