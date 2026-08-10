import { z } from "zod";

import { EQUIPMENT } from "../taxonomy/equipment";
import {
  MOVEMENT_PATTERNS,
  MOVEMENT_PLANES,
  TECHNICAL_DIFFICULTIES,
} from "../taxonomy/movement";
import { MUSCLE_GROUPS } from "../taxonomy/muscles";

/**
 * One record as it appears in `data/catalogue/*.json`.
 *
 * Only four fields are required. Everything else is omitted when it has not
 * been decided — and `.strict()` means a typo in an optional key fails the
 * build instead of silently vanishing, which is the failure mode that would
 * quietly hollow out a curated catalogue over time.
 */
export const catalogueEntrySchema = z
  .object({
    /** Immutable once published. See `data/ids.lock.json`. */
    id: z
      .string()
      .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Id deve ser um slug em minúsculas."),

    name: z.string().min(3).max(80),

    /**
     * Ordered by dominance. The first one decides which file the entry lives
     * in, which is why order is meaningful rather than incidental.
     */
    primaryMuscles: z.array(z.enum(MUSCLE_GROUPS)).min(1),

    equipment: z.array(z.enum(EQUIPMENT)).min(1),

    secondaryMuscles: z.array(z.enum(MUSCLE_GROUPS)).optional(),
    stabilizerMuscles: z.array(z.enum(MUSCLE_GROUPS)).optional(),

    movementPattern: z.enum(MOVEMENT_PATTERNS).optional(),
    movementPlanes: z.array(z.enum(MOVEMENT_PLANES)).min(1).optional(),
    technicalDifficulty: z.enum(TECHNICAL_DIFFICULTIES).optional(),

    isUnilateral: z.boolean().optional(),
    isCompound: z.boolean().optional(),
  })
  .strict()
  .refine(
    (entry) =>
      !entry.secondaryMuscles?.some((muscle) =>
        entry.primaryMuscles.includes(muscle),
      ),
    {
      message: "Um músculo não pode ser primário e secundário ao mesmo tempo.",
    },
  )
  .refine(
    (entry) =>
      !entry.stabilizerMuscles?.some(
        (muscle) =>
          entry.primaryMuscles.includes(muscle) ||
          entry.secondaryMuscles?.includes(muscle) === true,
      ),
    { message: "Um músculo estabilizador não pode também ser motor." },
  )
  .refine(
    (entry) => entry.isCompound !== false || entry.primaryMuscles.length === 1,
    {
      message:
        "Um exercício isolado tem exatamente um músculo primário. Se treina vários, é composto.",
    },
  )
  .refine(
    (entry) =>
      entry.movementPattern !== "isolation" || entry.isCompound !== true,
    { message: "Padrão 'isolation' contradiz isCompound: true." },
  );

export type CatalogueEntry = z.infer<typeof catalogueEntrySchema>;
