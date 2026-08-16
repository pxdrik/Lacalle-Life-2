import { z } from "zod";

import { DataError } from "@/core/domain/data-error";
import { openDatabase } from "@/core/storage/indexeddb/database";
import { BODY_ENTRIES_STORE } from "@/features/body/data/body-repository";
import type { BodyEntry } from "@/features/body/types/body-entry";
import { DIETS_STORE } from "@/features/diet/data/diet-store";
import { FOOD_LOGS_STORE } from "@/features/diet/data/food-log-repository";
import type { Diet } from "@/features/diet/types/diet";
import type { FoodLog } from "@/features/diet/types/food-log";
import { FOODS_STORE } from "@/features/foods/data/food-store";
import type { Food } from "@/features/foods/types/food";
import { PROFILE_STORE } from "@/features/profile/data/profile-repository";
import type { Profile } from "@/features/profile/types/profile";
import { EXERCISES_STORE } from "@/features/workouts/data/exercise-repository";
import { ROUTINES_STORE } from "@/features/workouts/data/routine-repository";
import { SESSIONS_STORE } from "@/features/workouts/data/session-repository";
import type { Exercise } from "@/features/workouts/types/exercise";
import type { Routine } from "@/features/workouts/types/routine";
import type { Session } from "@/features/workouts/types/session";

import { DATABASE_NAME, MIGRATIONS } from "./migrations";
import { getRepositories } from "./repositories";

/**
 * Whole-database backup — every store, restorable on a clean install.
 *
 * This is the recovery mechanism a local-first app without a server has to
 * have: nothing else survives clearing the browser, uninstalling the PWA, or
 * losing the phone. `navigator.storage.persist()` is hardening against the
 * browser evicting storage under pressure — it does not cover any of those,
 * so it is not a substitute for this and is deliberately built after it.
 *
 * Bumped whenever the shape of the file itself changes — not on every
 * `MIGRATIONS` entry. A schema migration that only adds a store or a field is
 * still readable by an older-format importer's `entityRecordSchema` check;
 * this version is for the *envelope*, not the database.
 */
export const BACKUP_FORMAT_VERSION = 1;

const STORE_NAMES = [
  BODY_ENTRIES_STORE.name,
  FOOD_LOGS_STORE.name,
  FOODS_STORE.name,
  DIETS_STORE.name,
  PROFILE_STORE.name,
  EXERCISES_STORE.name,
  ROUTINES_STORE.name,
  SESSIONS_STORE.name,
] as const;

export interface BackupFile {
  readonly schemaVersion: number;
  readonly exportedAt: number;
  readonly stores: {
    readonly body: readonly BodyEntry[];
    readonly foodLogs: readonly FoodLog[];
    readonly foods: readonly Food[];
    readonly diets: readonly Diet[];
    readonly profile: readonly Profile[];
    readonly exercises: readonly Exercise[];
    readonly routines: readonly Routine[];
    readonly sessions: readonly Session[];
  };
}

/**
 * Reads every store through the same repositories the app itself reads
 * through, not a raw dump — `foodLogs` and `body` normalize records that
 * predate a field, and a backup is a bad place to reintroduce a shape the
 * rest of the app no longer has to handle.
 */
export async function exportAll(): Promise<BackupFile> {
  const repositories = await getRepositories();
  const profile = await repositories.profile.get();

  const [body, foodLogs, foods, diets, exercises, routines, sessions] =
    await Promise.all([
      repositories.body.listAll(),
      repositories.foodLogs.listAll(),
      repositories.foods.listAll(),
      repositories.diets.listAll(),
      repositories.exercises.listAll(),
      repositories.routines.listAll(),
      repositories.sessions.listAll(),
    ]);

  return {
    schemaVersion: BACKUP_FORMAT_VERSION,
    exportedAt: Date.now(),
    stores: {
      body,
      foodLogs,
      foods,
      diets,
      profile: profile === undefined ? [] : [profile],
      exercises,
      routines,
      sessions,
    },
  };
}

/**
 * The minimum every stored record has, regardless of which store it is in.
 *
 * Deliberately not a deep, per-domain schema: that would mean maintaining a
 * second description of `Diet`, `Routine`, `Session` and five other types
 * that already exist as TypeScript types, and would drift from them the first
 * time either changed alone. What matters for import safety is catching
 * garbage — a truncated file, a hand-edited field with the wrong type, a file
 * from something that is not this app's export — not re-verifying every
 * business rule an entity already enforces on the way in.
 */
const entityRecordSchema = z
  .object({
    id: z.string().min(1),
    createdAt: z.number(),
    updatedAt: z.number(),
  })
  .loose();

const backupFileSchema = z.object({
  schemaVersion: z.number(),
  exportedAt: z.number(),
  stores: z.object({
    body: z.array(entityRecordSchema),
    foodLogs: z.array(entityRecordSchema),
    foods: z.array(entityRecordSchema),
    diets: z.array(entityRecordSchema),
    profile: z.array(entityRecordSchema).max(1),
    exercises: z.array(entityRecordSchema),
    routines: z.array(entityRecordSchema),
    sessions: z.array(entityRecordSchema),
  }),
});

export type ImportResult =
  | { readonly ok: true; readonly recordCount: number }
  | { readonly ok: false; readonly reason: "invalid" | "incompatible" };

/**
 * Validates the whole file before writing anything, and writes every store in
 * one IndexedDB transaction spanning all of them.
 *
 * The ordering is the point: a file that fails validation never opens a
 * transaction, so a bad import cannot leave the database half-replaced. And
 * because every store clears and refills inside one transaction rather than
 * one each, a failure partway through — a quota hit on the sixth store, say —
 * rolls back every store already written in this call, not just that one.
 * The person either gets their new data or keeps exactly what they had.
 */
export async function importAll(raw: unknown): Promise<ImportResult> {
  let parsedJson: unknown;

  if (typeof raw === "string") {
    try {
      parsedJson = JSON.parse(raw);
    } catch {
      return { ok: false, reason: "invalid" };
    }
  } else {
    parsedJson = raw;
  }

  const parsed = backupFileSchema.safeParse(parsedJson);
  if (!parsed.success) return { ok: false, reason: "invalid" };

  if (parsed.data.schemaVersion !== BACKUP_FORMAT_VERSION) {
    return { ok: false, reason: "incompatible" };
  }

  const { stores } = parsed.data;
  const db = await openDatabase(DATABASE_NAME, MIGRATIONS);

  try {
    const tx = db.transaction(STORE_NAMES, "readwrite");

    const writes = [
      writeStore(tx.objectStore(BODY_ENTRIES_STORE.name), stores.body),
      writeStore(tx.objectStore(FOOD_LOGS_STORE.name), stores.foodLogs),
      writeStore(tx.objectStore(FOODS_STORE.name), stores.foods),
      writeStore(tx.objectStore(DIETS_STORE.name), stores.diets),
      writeStore(tx.objectStore(PROFILE_STORE.name), stores.profile),
      writeStore(tx.objectStore(EXERCISES_STORE.name), stores.exercises),
      writeStore(tx.objectStore(ROUTINES_STORE.name), stores.routines),
      writeStore(tx.objectStore(SESSIONS_STORE.name), stores.sessions),
    ];

    await Promise.all([...writes, tx.done]);
  } catch (cause) {
    throw cause instanceof DataError
      ? cause
      : new DataError("FAILED", "Falha ao restaurar o backup.", { cause });
  }

  const recordCount =
    stores.body.length +
    stores.foodLogs.length +
    stores.foods.length +
    stores.diets.length +
    stores.profile.length +
    stores.exercises.length +
    stores.routines.length +
    stores.sessions.length;

  return { ok: true, recordCount };
}

/** Clears the store and writes every record, as part of the caller's transaction. */
async function writeStore(
  store: { clear(): unknown; put(record: unknown): unknown },
  records: readonly unknown[],
): Promise<void> {
  await store.clear();
  await Promise.all(records.map((record) => store.put(record)));
}
