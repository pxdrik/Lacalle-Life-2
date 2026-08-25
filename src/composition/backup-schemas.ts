import { z } from "zod";

import { MEASUREMENT_BOUNDS } from "@/features/body/validation/body-schema";
import { MEASUREMENT_SITES } from "@/features/body/taxonomy/measurement-sites";
import { WEEKDAYS } from "@/features/diet/services/diet-schedule";
import type { Weekday } from "@/features/diet/types/diet";
import { MAX_GRAMS } from "@/features/diet/components/meal-item-row";
import { catalogueEntrySchema } from "@/features/foods/validation/food-schema";
import { INPUT_BOUNDS, nutritionProfileSchema } from "@/core/nutrition";
import { EQUIPMENT } from "@/features/workouts/taxonomy/equipment";
import { MEDIA_SOURCES } from "@/features/workouts/taxonomy/media-sources";
import {
  MOVEMENT_PATTERNS,
  MOVEMENT_PLANES,
  TECHNICAL_DIFFICULTIES,
} from "@/features/workouts/taxonomy/movement";
import { MUSCLE_GROUPS } from "@/features/workouts/taxonomy/muscles";
import { CLASSIFICATION_SOURCES } from "@/features/workouts/types/exercise";

/**
 * What every store, at rest, actually contains — reused to validate an
 * imported backup the same way the app validates everything it writes
 * itself.
 *
 * A backup is untrusted input, exactly like a form submission: the shallow
 * envelope check in `backup.ts` (`id`/`createdAt`/`updatedAt`, `.loose()`)
 * catches a truncated or unrelated file, but it was proven in production —
 * the 2026-08-24 adversarial audit — to also accept `kcal: 999999999`,
 * `weightKg: -999999999`, a 50 000-character name, and a `bodyEntries` record
 * shaped nothing like `BodyEntry`. That last one crashed `/evolucao` outright:
 * `formatDay` calls `.split("-")` on `day`, and the malformed record had no
 * `day` at all.
 *
 * Every schema below composes from the same bound, enum, or taxonomy array
 * the form for that domain already validates against — `INPUT_BOUNDS`/
 * `MEASUREMENT_BOUNDS` for body, `catalogueEntrySchema` for foods,
 * `nutritionProfileSchema` for the profile, and the muscle/equipment/movement
 * enums for exercises — so a bound changed in one place is validated the
 * same way on both the form and the import path. `.strict()` throughout: an
 * unrecognised field (`role: "admin"`, `isAdmin: true`) fails the record
 * rather than being written verbatim.
 *
 * **A stored record and a form submission are not the same shape**, and
 * body/foods/foodLogs each learned this the hard way in the 2026-08-24
 * pre-deploy review: the first version of this file reused `bodyEntrySchema`
 * (the form) wholesale via `.extend()`, which meant every field the form
 * always fully submits was required here too — and rejected the exact
 * legacy shapes `LocalBodyRepository`/`LocalFoodRepository`/
 * `LocalFoodLogRepository`'s own `normalize()` functions already prove the
 * app tolerates on read (a weigh-in from before `notes` existed, a food from
 * before `isFavorite`, a day from before `dietId`). Because
 * `backupFileSchema` validates the whole file as one unit, one such record
 * failed the entire backup, not just itself. Every field marked `.optional()`
 * below mirrors a `?? ` fallback that already exists in that domain's
 * `normalize()` — no more, no less; see each schema's own comment for which
 * fallback justifies which field.
 *
 * Diets, routines and sessions had no existing schema to reuse and no
 * `normalize()` to mirror — nothing before this imported a backup at all,
 * and none of the three repositories default a missing field on read — so
 * their shape is spelled out here directly from the domain types in
 * `features/*\/types`, fully required.
 */

/**
 * A finite number within `[min, max]`, in Portuguese.
 *
 * `z.number()` already rejects `NaN` and `±Infinity` on its own in this Zod
 * version — there is no separate `.finite()` to reach for — so the bound is
 * what actually stops `1e308` and the rest of the audit's extreme-value
 * payloads from reaching storage.
 */
function bounded(message: string, min: number, max: number) {
  return z.number({ error: message }).min(min, message).max(max, message);
}

const entityEnvelope = {
  id: z.string().min(1).max(200),
  createdAt: bounded("createdAt inválido.", 0, 8_640_000_000_000_000),
  updatedAt: bounded("updatedAt inválido.", 0, 8_640_000_000_000_000),
};

/** `YYYY-MM-DD`, the exact shape `core/format/day.ts` parses with `.split("-")`. */
const dayString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Dia em formato inválido.");

const NOTES_MAX = 4000;
const NAME_MAX = 200;

// ---------------------------------------------------------------------------
// body
// ---------------------------------------------------------------------------

/**
 * `INPUT_BOUNDS`/`MEASUREMENT_BOUNDS` are the same ranges `body-schema.ts`'s
 * `bodyEntrySchema` (the form) validates against — reused here rather than
 * re-stated, so a bound changed in one place still means the same thing on
 * both paths.
 *
 * Deliberately **not** `bodyEntrySchema` itself, though: that schema commits
 * to fields the form always fully submits, `notes`/`weightKg`/
 * `bodyFatPercent`/every measurement site required (nullable, but present).
 * `LocalBodyRepository`'s own `normalize()` proves a *stored* record does
 * not carry that guarantee — `notes: entry.notes ?? ""`, `weightKg: entry.
 * weightKg ?? null`, `bodyFatPercent: entry.bodyFatPercent ?? null`, and
 * `measurements: { ...EMPTY_MEASUREMENTS, ...entry.measurements }`, which
 * tolerates the whole `measurements` object being absent as much as one site
 * within it (`{...undefined}` is `{}`, so a legacy record from before this
 * app read the field at all is exactly as valid an input as one missing a
 * single site added after it was written). The 2026-08-24 pre-deploy review
 * caught the first version of this schema requiring all four regardless,
 * which rejected exactly the shape `LocalBodyRepository` already tolerates —
 * and, because `backupFileSchema` validates the whole file as one unit,
 * rejected the entire backup over one old weigh-in.
 *
 * Every field below is optional for that reason and no other: this is not a
 * generally permissive schema, it is one that stops exactly where the read
 * path's own tolerance stops. A record missing `id`/`createdAt`/`updatedAt`/
 * `day` is still rejected — nothing in `normalize()` defaults those, so
 * nothing here does either.
 */
type OptionalMeasurement = z.ZodOptional<z.ZodNullable<ReturnType<typeof bounded>>>;

const legacyMeasurementsSchema = z
  .object(
    Object.fromEntries(
      MEASUREMENT_SITES.map((site) => [
        site,
        bounded(
          "Medida inválida.",
          MEASUREMENT_BOUNDS.min,
          MEASUREMENT_BOUNDS.max,
        )
          .nullable()
          .optional(),
      ]),
    ) as Record<(typeof MEASUREMENT_SITES)[number], OptionalMeasurement>,
  )
  .strict();

export const bodyRecordSchema = z
  .object({
    ...entityEnvelope,
    day: dayString,
    notes: z.string().max(NOTES_MAX).optional(),
    weightKg: bounded(
      "Peso inválido.",
      INPUT_BOUNDS.weightKg.min,
      INPUT_BOUNDS.weightKg.max,
    )
      .nullable()
      .optional(),
    bodyFatPercent: bounded(
      "Gordura corporal inválida.",
      INPUT_BOUNDS.bodyFatPercent.min,
      INPUT_BOUNDS.bodyFatPercent.max,
    )
      .nullable()
      .optional(),
    measurements: legacyMeasurementsSchema.optional(),
  })
  .strict();

// ---------------------------------------------------------------------------
// foods
// ---------------------------------------------------------------------------

/**
 * `catalogueEntrySchema` already validates `id`/`name`/`category`/`per100g`
 * with the same 900 kcal-per-100g ceiling the custom-food form enforces —
 * reused here rather than re-stated, so `kcal: 999999999` fails on import
 * exactly as it fails on the form.
 */
/**
 * `isFavorite` is optional, and nothing else here is — `LocalFoodRepository`'s
 * own `normalize()` defaults exactly that one field (`food.isFavorite ??
 * false`) for a record written before it existed, proven by that
 * repository's own "forward compatibility" test. `isCustom` gets no such
 * treatment anywhere in the read path, so it stays required: normalize()
 * tolerating a field is the only reason a field is optional here, not a
 * general relaxation.
 */
export const foodRecordSchema = z
  .object({
    createdAt: entityEnvelope.createdAt,
    updatedAt: entityEnvelope.updatedAt,
    isCustom: z.boolean(),
    isFavorite: z.boolean().optional(),
  })
  .extend(catalogueEntrySchema.shape)
  .strict();

// ---------------------------------------------------------------------------
// exercises
// ---------------------------------------------------------------------------

const muscleListSchema = z.array(z.enum(MUSCLE_GROUPS));

const mediaSourceKeys = Object.keys(MEDIA_SOURCES) as [string, ...string[]];

const creditSchema = z
  .object({
    author: z.string().min(1).max(NAME_MAX),
    license: z.string().min(1).max(NAME_MAX),
    licenseUrl: z.url(),
  })
  .strict();

const exerciseMediaSchema = z
  .object({
    source: z.enum(mediaSourceKeys),
    images: z.array(z.string().min(1).max(500)).max(50),
    credit: creditSchema.nullable(),
  })
  .strict();

/**
 * No form schema existed to reuse — `customExerciseSchema` only covers the
 * three fields the "create your own exercise" form asks for, while a stored
 * `Exercise` also carries every field the curated catalogue seeds (muscles,
 * equipment, media, classification…). Built directly from the `Exercise`
 * type instead, with the same taxonomy arrays the app's own filters use.
 *
 * The fields `LocalExerciseRepository`'s `normalize()` already defaults on
 * read (`aliases`, the three muscle lists, `equipment`, `movementPlanes`,
 * `media`, `isFavorite`) stay optional here for the same reason: a real
 * backup from an older release can predate one of them, and rejecting the
 * whole file over a field the app already knows how to default would be
 * strictly worse than what reading the same record from IndexedDB does today.
 */
export const exerciseRecordSchema = z
  .object({
    ...entityEnvelope,
    name: z.string().min(1).max(NAME_MAX),
    aliases: z.array(z.string().min(1).max(NAME_MAX)).optional(),
    primaryMuscles: muscleListSchema.optional(),
    secondaryMuscles: muscleListSchema.optional(),
    stabilizerMuscles: muscleListSchema.optional(),
    equipment: z.array(z.enum(EQUIPMENT)).optional(),
    movementPattern: z.enum(MOVEMENT_PATTERNS).nullable(),
    movementPlanes: z.array(z.enum(MOVEMENT_PLANES)).optional(),
    technicalDifficulty: z.enum(TECHNICAL_DIFFICULTIES).nullable(),
    isUnilateral: z.boolean().nullable(),
    isCompound: z.boolean().nullable(),
    media: exerciseMediaSchema.nullable().optional(),
    classification: z.enum(CLASSIFICATION_SOURCES),
    isCustom: z.boolean(),
    isFavorite: z.boolean().optional(),
  })
  .strict();

// ---------------------------------------------------------------------------
// profile
// ---------------------------------------------------------------------------

/**
 * `nutritionProfileSchema` is already "the one schema, used on every entry
 * point" per its own doc comment — the import path is one more entry point,
 * not a reason to restate `INPUT_BOUNDS`.
 */
export const profileRecordSchema = z
  .object({
    ...entityEnvelope,
    nutrition: nutritionProfileSchema.strict(),
  })
  .strict();

// ---------------------------------------------------------------------------
// diets / foodLogs — both carry `meals`
// ---------------------------------------------------------------------------

const macrosSchema = z
  .object({
    kcal: bounded("kcal inválido.", 0, 100_000),
    proteinG: bounded("proteína inválida.", 0, 100_000),
    carbsG: bounded("carboidrato inválido.", 0, 100_000),
    fatG: bounded("gordura inválida.", 0, 100_000),
  })
  .strict();

const mealItemSchema = z
  .object({
    id: z.string().min(1).max(200),
    foodId: z.string().min(1).max(200).nullable(),
    name: z.string().min(1).max(NAME_MAX),
    grams: bounded("grams inválido.", 0, MAX_GRAMS),
    unit: z.enum(["g", "ml"]),
    per100g: macrosSchema,
  })
  .strict();

const mealSchema = z
  .object({
    id: z.string().min(1).max(200),
    name: z.string().min(1).max(NAME_MAX),
    time: z
      .string()
      .regex(/^\d{2}:\d{2}$/, "Horário em formato inválido.")
      .nullable(),
    notes: z.string().max(NOTES_MAX),
    items: z.array(mealItemSchema).max(500),
  })
  .strict();

export const dietRecordSchema = z
  .object({
    ...entityEnvelope,
    name: z.string().min(1).max(NAME_MAX),
    meals: z.array(mealSchema).max(200),
    weekdays: z.array(z.enum(WEEKDAYS as [Weekday, ...Weekday[]])),
  })
  .strict();

/**
 * `meals` and `dietId` are optional — `LocalFoodLogRepository`'s own
 * `normalize()` defaults exactly these two (`log.meals ?? []`, `log.dietId
 * ?? null`) for a record predating one of them, so a legacy day is exactly
 * as valid an import as one this repository already reads without complaint.
 * `id`/`day` stay required: nothing defaults those.
 */
export const foodLogRecordSchema = z
  .object({
    ...entityEnvelope,
    day: dayString,
    meals: z.array(mealSchema).max(200).optional(),
    dietId: z.string().min(1).max(200).nullable().optional(),
  })
  .strict();

// ---------------------------------------------------------------------------
// routines
// ---------------------------------------------------------------------------

const plannedSetSchema = z
  .object({
    id: z.string().min(1).max(200),
    reps: bounded("reps inválido.", 0, 100_000).nullable(),
    weightKg: bounded("weightKg inválido.", 0, 100_000).nullable(),
    rpe: bounded("rpe inválido.", 0, 10).nullable(),
  })
  .strict();

const routineExerciseSchema = z
  .object({
    id: z.string().min(1).max(200),
    exerciseId: z.string().min(1).max(200),
    name: z.string().min(1).max(NAME_MAX),
    sets: z.array(plannedSetSchema).max(100),
    restSeconds: bounded("restSeconds inválido.", 0, 100_000).nullable(),
    notes: z.string().max(NOTES_MAX),
  })
  .strict();

export const routineRecordSchema = z
  .object({
    ...entityEnvelope,
    name: z.string().min(1).max(NAME_MAX),
    notes: z.string().max(NOTES_MAX),
    exercises: z.array(routineExerciseSchema).max(200),
  })
  .strict();

// ---------------------------------------------------------------------------
// sessions
// ---------------------------------------------------------------------------

const plannedTargetSchema = z
  .object({
    reps: bounded("reps inválido.", 0, 100_000).nullable(),
    weightKg: bounded("weightKg inválido.", 0, 100_000).nullable(),
    rpe: bounded("rpe inválido.", 0, 10).nullable(),
  })
  .strict();

const performedSetSchema = z
  .object({
    id: z.string().min(1).max(200),
    reps: bounded("reps inválido.", 0, 100_000).nullable(),
    weightKg: bounded("weightKg inválido.", 0, 100_000).nullable(),
    rpe: bounded("rpe inválido.", 0, 10).nullable(),
    isCompleted: z.boolean(),
    planned: plannedTargetSchema.nullable(),
  })
  .strict();

const sessionExerciseSchema = z
  .object({
    id: z.string().min(1).max(200),
    exerciseId: z.string().min(1).max(200),
    name: z.string().min(1).max(NAME_MAX),
    sets: z.array(performedSetSchema).max(100),
    restSeconds: bounded("restSeconds inválido.", 0, 100_000).nullable(),
    notes: z.string().max(NOTES_MAX),
  })
  .strict();

export const sessionRecordSchema = z
  .object({
    ...entityEnvelope,
    routineId: z.string().min(1).max(200).nullable(),
    name: z.string().min(1).max(NAME_MAX),
    startedAt: bounded("startedAt inválido.", 0, 8_640_000_000_000_000),
    finishedAt: bounded("finishedAt inválido.", 0, 8_640_000_000_000_000).nullable(),
    exercises: z.array(sessionExerciseSchema).max(200),
  })
  .strict();

// ---------------------------------------------------------------------------

/** One schema per store name, keyed exactly as `backup.ts`'s `stores` object is. */
export const RECORD_SCHEMAS = {
  body: bodyRecordSchema,
  foodLogs: foodLogRecordSchema,
  foods: foodRecordSchema,
  diets: dietRecordSchema,
  profile: profileRecordSchema,
  exercises: exerciseRecordSchema,
  routines: routineRecordSchema,
  sessions: sessionRecordSchema,
} as const;
