import { z } from "zod";

import { RECORD_SCHEMAS } from "./backup-schemas";
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
 * Every record is validated against the same schema the app itself writes
 * through — `RECORD_SCHEMAS`, in `./backup-schemas` — not just a shallow
 * `id`/`createdAt`/`updatedAt` shape.
 *
 * That shallow check is what this used to be, on the reasoning that a second
 * description of `Diet`, `Routine`, `Session` and five other types would drift
 * from the real ones. It shipped anyway, and the 2026-08-24 adversarial audit
 * against production walked straight through the gap it left: `kcal:
 * 999999999`, `weightKg: -999999999`, a 50 000-character name and `role:
 * "admin"` all imported and persisted without complaint, and a `bodyEntries`
 * record shaped nothing like `BodyEntry` crashed `/evolucao` outright. A
 * backup is a file someone else can hand you, exactly like a form submission
 * — the difference is only that nothing here rejects a bad one at the point
 * where a form would.
 *
 * `RECORD_SCHEMAS` closes that by composing from the domain's own schemas and
 * types instead of restating them, so a bound changed in `body-schema.ts` or
 * `food-schema.ts` is enforced on import automatically. Where none existed —
 * diets, food logs, routines, sessions — the schema is built from the domain
 * type directly, `.strict()`, so an unrecognised field is rejected rather
 * than written to IndexedDB verbatim.
 */
const backupFileSchema = z.object({
  schemaVersion: z.number(),
  exportedAt: z.number(),
  stores: z.object({
    body: z.array(RECORD_SCHEMAS.body),
    foodLogs: z.array(RECORD_SCHEMAS.foodLogs),
    foods: z.array(RECORD_SCHEMAS.foods),
    diets: z.array(RECORD_SCHEMAS.diets),
    profile: z.array(RECORD_SCHEMAS.profile).max(1),
    exercises: z.array(RECORD_SCHEMAS.exercises),
    routines: z.array(RECORD_SCHEMAS.routines),
    sessions: z.array(RECORD_SCHEMAS.sessions),
  }),
});

export type ImportResult =
  | { readonly ok: true; readonly recordCount: number }
  | { readonly ok: false; readonly reason: "invalid" | "incompatible" };

type ParsedBackupFile = z.infer<typeof backupFileSchema>;

type ParsedBackup =
  | {
      readonly ok: true;
      readonly file: ParsedBackupFile;
      readonly recordCount: number;
    }
  | { readonly ok: false; readonly reason: "invalid" | "incompatible" };

/**
 * Validation and record-counting, with no store touched — the read half of
 * `importAll`, split out so a caller can show what a file contains **before**
 * asking for the confirmation that replaces every domain with it.
 *
 * A technically valid backup with zero records used to reach that same
 * confirmation dialog as any other file, because `recordCount` was only ever
 * computed after the write. Someone who confirms out of habit — even past the
 * `ConfirmButton` double tap — could replace real data with an empty or
 * corrupted file without a chance to notice first.
 */
function parseBackupFile(raw: unknown): ParsedBackup {
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
  const recordCount =
    stores.body.length +
    stores.foodLogs.length +
    stores.foods.length +
    stores.diets.length +
    stores.profile.length +
    stores.exercises.length +
    stores.routines.length +
    stores.sessions.length;

  return { ok: true, file: parsed.data, recordCount };
}

/**
 * Read-only preview of what a file would do, for the confirmation step —
 * never opens a database transaction.
 */
export function previewImport(raw: unknown): ImportResult {
  const parsed = parseBackupFile(raw);
  return parsed.ok
    ? { ok: true, recordCount: parsed.recordCount }
    : { ok: false, reason: parsed.reason };
}

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
  const parsed = parseBackupFile(raw);
  if (!parsed.ok) return parsed;

  const { stores } = parsed.file;
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
