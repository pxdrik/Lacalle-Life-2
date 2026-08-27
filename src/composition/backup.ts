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
 * The file's own envelope — versioning and which eight arrays exist — kept
 * deliberately separate from `RECORD_SCHEMAS`. This is the one check that
 * still fails the *whole* file: a file with no `stores`, or `stores` missing
 * an array, is not "a backup with some bad records", it is not a backup at
 * all, and no per-record repair belongs anywhere near it. Each array's
 * elements are `z.unknown()` here on purpose — what makes a single diet or
 * session record valid is `RECORD_SCHEMAS`' job, run per record in
 * `processStore` below, not this schema's.
 */
const backupEnvelopeSchema = z.object({
  schemaVersion: z.number(),
  exportedAt: z.number(),
  stores: z.object({
    body: z.array(z.unknown()),
    foodLogs: z.array(z.unknown()),
    foods: z.array(z.unknown()),
    diets: z.array(z.unknown()),
    profile: z.array(z.unknown()).max(1),
    exercises: z.array(z.unknown()),
    routines: z.array(z.unknown()),
    sessions: z.array(z.unknown()),
  }),
});

export type ImportResult =
  | {
      readonly ok: true;
      readonly recordCount: number;
      /**
       * Records kept only after nulling one out-of-range field — see
       * `repairRecord`. Never zero for a backup written before a bound this
       * app enforces today existed; that is expected, not a warning sign.
       */
      readonly sanitizedCount: number;
      /** Records that could not be recovered safely, and were dropped. */
      readonly discardedCount: number;
    }
  | { readonly ok: false; readonly reason: "invalid" | "incompatible" };

type ParsedBackup =
  | {
      readonly ok: true;
      readonly stores: StoresResult;
      readonly recordCount: number;
      readonly sanitizedCount: number;
      readonly discardedCount: number;
    }
  | { readonly ok: false; readonly reason: "invalid" | "incompatible" };

/**
 * The zod-inferred shape of each store, not the domain type directly:
 * `RECORD_SCHEMAS` already mirrors what each repository's own `normalize()`
 * tolerates (see that file's doc comment), which is a few fields optional
 * where the domain type has them required-but-nullable. `writeStore` puts
 * these straight into IndexedDB the same way `normalize()` would read them
 * back, so the mismatch is exactly as harmless here as it already is there.
 */
interface StoresResult {
  readonly body: readonly z.infer<typeof RECORD_SCHEMAS.body>[];
  readonly foodLogs: readonly z.infer<typeof RECORD_SCHEMAS.foodLogs>[];
  readonly foods: readonly z.infer<typeof RECORD_SCHEMAS.foods>[];
  readonly diets: readonly z.infer<typeof RECORD_SCHEMAS.diets>[];
  readonly profile: readonly z.infer<typeof RECORD_SCHEMAS.profile>[];
  readonly exercises: readonly z.infer<typeof RECORD_SCHEMAS.exercises>[];
  readonly routines: readonly z.infer<typeof RECORD_SCHEMAS.routines>[];
  readonly sessions: readonly z.infer<typeof RECORD_SCHEMAS.sessions>[];
}

/**
 * A single field, out of range, is the one class of "invalid" a backup can
 * legitimately contain: not corruption, just a record written before this
 * app enforced a bound it enforces today. `weightKg: -20` on a set from
 * before this session's fix is the case that found this — the exact rule
 * `updatePerformedSet`'s own `sanitizeSetChanges` already applies live (see
 * `edit-session.ts`): a value nobody can make sense of is *absent*, not
 * corrected into some other number nobody typed. Same decision, same
 * reasoning, now also on the read side of a backup instead of only the
 * write side of a live edit.
 *
 * Generic on purpose, over one field name at a time: every bound in
 * `backup-schemas.ts` already states, in the schema itself, whether "absent"
 * is a meaning that field has (`.nullable()`) or not. Reading that off the
 * schema — attempt null, see if the record now parses — means a bound added
 * to some other store next month is repaired the same way automatically,
 * with nothing here naming that field by hand. A `too_small`/`too_big` issue
 * is the only thing ever touched: a wrong *type* (a string where a number
 * belongs), a missing required field, or an unrecognised key is not a
 * bound violation and is never "repaired" — see `processStore` for what
 * happens to a record repair cannot save.
 */
function repairRecord(raw: unknown, issues: readonly z.core.$ZodIssue[]): unknown {
  const repaired = structuredClone(raw);

  for (const issue of issues) {
    if (issue.code !== "too_small" && issue.code !== "too_big") continue;
    setAtPath(repaired, issue.path, null);
  }

  return repaired;
}

/** Mutates `target` at `path`, doing nothing if the path does not exist as an object/array chain. */
function setAtPath(
  target: unknown,
  path: readonly PropertyKey[],
  value: unknown,
): void {
  if (path.length === 0) return;

  let cursor = target;
  for (let i = 0; i < path.length - 1; i++) {
    if (cursor === null || typeof cursor !== "object") return;
    cursor = (cursor as Record<PropertyKey, unknown>)[path[i]!];
  }
  if (cursor === null || typeof cursor !== "object") return;
  (cursor as Record<PropertyKey, unknown>)[path[path.length - 1]!] = value;
}

interface StoreOutcome<T> {
  readonly records: readonly T[];
  readonly sanitizedCount: number;
  readonly discardedCount: number;
}

/**
 * Validates one store's array against its `RECORD_SCHEMAS` entry, record by
 * record — the fix for the whole file failing over one legacy value. A
 * record that fails validation gets one repair attempt (`repairRecord`); if
 * the repaired version still does not parse, that one record is dropped and
 * every other record in the store is unaffected. Nothing here invents a
 * value or turns a negative number positive — a field either already parses,
 * or becomes `null` because the schema says `null` is a meaning that field
 * already has, or the whole record is discarded.
 */
function processStore<T>(
  schema: z.ZodType<T>,
  rawRecords: readonly unknown[],
): StoreOutcome<T> {
  const records: T[] = [];
  let sanitizedCount = 0;
  let discardedCount = 0;

  for (const raw of rawRecords) {
    const parsed = schema.safeParse(raw);
    if (parsed.success) {
      records.push(parsed.data);
      continue;
    }

    const repaired = repairRecord(raw, parsed.error.issues);
    const reparsed = schema.safeParse(repaired);
    if (reparsed.success) {
      records.push(reparsed.data);
      sanitizedCount++;
    } else {
      discardedCount++;
    }
  }

  return { records, sanitizedCount, discardedCount };
}

/**
 * Validation, repair and record-counting, with no store touched — the read
 * half of `importAll`, split out so a caller can show what a file contains
 * **before** asking for the confirmation that replaces every domain with it.
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

  const envelope = backupEnvelopeSchema.safeParse(parsedJson);
  if (!envelope.success) return { ok: false, reason: "invalid" };

  if (envelope.data.schemaVersion !== BACKUP_FORMAT_VERSION) {
    return { ok: false, reason: "incompatible" };
  }

  const stores = envelope.data.stores;

  const body = processStore(RECORD_SCHEMAS.body, stores.body);
  const foodLogs = processStore(RECORD_SCHEMAS.foodLogs, stores.foodLogs);
  const foods = processStore(RECORD_SCHEMAS.foods, stores.foods);
  const diets = processStore(RECORD_SCHEMAS.diets, stores.diets);
  const profile = processStore(RECORD_SCHEMAS.profile, stores.profile);
  const exercises = processStore(RECORD_SCHEMAS.exercises, stores.exercises);
  const routines = processStore(RECORD_SCHEMAS.routines, stores.routines);
  const sessions = processStore(RECORD_SCHEMAS.sessions, stores.sessions);

  const outcomes = [
    body,
    foodLogs,
    foods,
    diets,
    profile,
    exercises,
    routines,
    sessions,
  ];

  return {
    ok: true,
    stores: {
      body: body.records,
      foodLogs: foodLogs.records,
      foods: foods.records,
      diets: diets.records,
      profile: profile.records,
      exercises: exercises.records,
      routines: routines.records,
      sessions: sessions.records,
    },
    recordCount: outcomes.reduce((sum, o) => sum + o.records.length, 0),
    sanitizedCount: outcomes.reduce((sum, o) => sum + o.sanitizedCount, 0),
    discardedCount: outcomes.reduce((sum, o) => sum + o.discardedCount, 0),
  };
}

/**
 * Read-only preview of what a file would do, for the confirmation step —
 * never opens a database transaction.
 */
export function previewImport(raw: unknown): ImportResult {
  const parsed = parseBackupFile(raw);
  return parsed.ok
    ? {
        ok: true,
        recordCount: parsed.recordCount,
        sanitizedCount: parsed.sanitizedCount,
        discardedCount: parsed.discardedCount,
      }
    : { ok: false, reason: parsed.reason };
}

/**
 * Validates (and repairs what it safely can) before writing anything, and
 * writes every store in one IndexedDB transaction spanning all of them.
 *
 * The ordering is the point: a file that fails the envelope check never opens
 * a transaction, so a bad import cannot leave the database half-replaced. And
 * because every store clears and refills inside one transaction rather than
 * one each, a failure partway through — a quota hit on the sixth store, say —
 * rolls back every store already written in this call, not just that one.
 * The person either gets their new data or keeps exactly what they had.
 *
 * A store that discards every one of its records still writes — as an empty
 * store, the same as an intentionally empty backup already does. "Replace,
 * never merge" is this feature's contract regardless of why a record did not
 * make it into the replacement.
 */
export async function importAll(raw: unknown): Promise<ImportResult> {
  const parsed = parseBackupFile(raw);
  if (!parsed.ok) return parsed;

  const { stores } = parsed;
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

  return {
    ok: true,
    recordCount: parsed.recordCount,
    sanitizedCount: parsed.sanitizedCount,
    discardedCount: parsed.discardedCount,
  };
}

/** Clears the store and writes every record, as part of the caller's transaction. */
async function writeStore(
  store: { clear(): unknown; put(record: unknown): unknown },
  records: readonly unknown[],
): Promise<void> {
  await store.clear();
  await Promise.all(records.map((record) => store.put(record)));
}
