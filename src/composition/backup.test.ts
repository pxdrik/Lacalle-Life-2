import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createBodyEntry } from "@/features/body/services/body-log";
import type { BodyEntry } from "@/features/body/types/body-entry";
import { createDiet } from "@/features/diet/services/create-diet";
import { createFoodLog } from "@/features/diet/services/start-day";
import type { Diet } from "@/features/diet/types/diet";
import type { FoodLog } from "@/features/diet/types/food-log";
import type { Food } from "@/features/foods/types/food";
import { PROFILE_ID, type Profile } from "@/features/profile/types/profile";
import { createRoutine } from "@/features/workouts/services/create-routine";
import { startSession } from "@/features/workouts/services/start-session";
import type { Exercise } from "@/features/workouts/types/exercise";
import type { Routine } from "@/features/workouts/types/routine";
import type { Session } from "@/features/workouts/types/session";

import {
  BACKUP_FORMAT_VERSION,
  exportAll,
  importAll,
  previewImport,
} from "./backup";
import { openDatabase } from "@/core/storage/indexeddb/database";
import { DATABASE_NAME, MIGRATIONS } from "./migrations";
import { getRepositories } from "./repositories";

/**
 * `getRepositories()` caches its connection at module scope, by design — "a
 * repository is always handed out ready to read from". That means every test
 * here shares one underlying `fake-indexeddb` database rather than getting a
 * fresh one, so each test clears every store by hand instead of relying on
 * isolation the production code deliberately does not have.
 */
async function clearAllStores() {
  const db = await openDatabase(DATABASE_NAME, MIGRATIONS);
  const names = [...db.objectStoreNames];
  const tx = db.transaction(names, "readwrite");
  await Promise.all([
    ...names.map((name) => tx.objectStore(name).clear()),
    tx.done,
  ]);
}

/** Minimal fixtures for the two domains with no simple factory available. */
function customFood(name: string): Food {
  const now = Date.now();
  return {
    id: `food-${name}`,
    name,
    category: "protein",
    per100g: { kcal: 100, proteinG: 10, carbsG: 5, fatG: 2 },
    isCustom: true,
    isFavorite: false,
    createdAt: now,
    updatedAt: now,
  } as Food;
}

function customExercise(name: string): Exercise {
  const now = Date.now();
  return {
    id: `exercise-${name}`,
    name,
    aliases: [],
    createdAt: now,
    updatedAt: now,
  } as unknown as Exercise;
}

function profile(): Profile {
  const now = Date.now();
  return {
    id: PROFILE_ID,
    nutrition: { sex: "female", goal: "maintain" },
    createdAt: now,
    updatedAt: now,
  } as unknown as Profile;
}

// Forces the one-time catalogue seed (216 foods, 183 exercises) to happen
// before any test's `clearAllStores` runs — otherwise whichever test
// happens to call `getRepositories()` first triggers it mid-test, and the
// seed shows up as unexpected records in that test's assertions.
beforeAll(async () => {
  await getRepositories();
});

beforeEach(async () => {
  await clearAllStores();
});

describe("exportAll / importAll", () => {
  it("round-trips every domain: dieta, treino, sessão, diário, evolução, perfil", async () => {
    const repositories = await getRepositories();

    const diet: Diet = createDiet("Cutting");
    const routine: Routine = createRoutine("Push A");
    const session: Session = startSession(routine);
    const foodLog: FoodLog = createFoodLog("2026-08-16");
    const bodyEntry: BodyEntry = createBodyEntry("2026-08-16");
    const food = customFood("Ovo");
    const exercise = customExercise("Supino reto");
    const profileRecord = profile();

    await Promise.all([
      repositories.diets.save(diet, null),
      repositories.routines.save(routine, null),
      repositories.sessions.save(session, null),
      repositories.foodLogs.save(foodLog, null),
      repositories.body.save(bodyEntry, null),
      repositories.foods.save(food),
      repositories.exercises.save(exercise),
      repositories.profile.save(profileRecord),
    ]);

    const backup = await exportAll();
    expect(backup.schemaVersion).toBe(BACKUP_FORMAT_VERSION);
    expect(backup.stores.diets).toHaveLength(1);
    expect(backup.stores.routines).toHaveLength(1);
    expect(backup.stores.sessions).toHaveLength(1);
    expect(backup.stores.foodLogs).toHaveLength(1);
    expect(backup.stores.body).toHaveLength(1);
    expect(backup.stores.foods).toHaveLength(1);
    expect(backup.stores.exercises).toHaveLength(1);
    expect(backup.stores.profile).toHaveLength(1);

    await clearAllStores();
    await expect(repositories.diets.listAll()).resolves.toEqual([]);
    await expect(repositories.profile.get()).resolves.toBeUndefined();

    const result = await importAll(backup);
    expect(result).toMatchObject({ ok: true });

    await expect(repositories.diets.listAll()).resolves.toMatchObject([
      { name: "Cutting" },
    ]);
    await expect(repositories.routines.listAll()).resolves.toMatchObject([
      { name: "Push A" },
    ]);
    await expect(repositories.sessions.listAll()).resolves.toMatchObject([
      { id: session.id },
    ]);
    await expect(
      repositories.foodLogs.getByDay("2026-08-16"),
    ).resolves.toMatchObject({ id: "2026-08-16" });
    await expect(
      repositories.body.getByDay("2026-08-16"),
    ).resolves.toMatchObject({ id: "2026-08-16" });
    await expect(repositories.foods.listAll()).resolves.toMatchObject([
      { name: "Ovo" },
    ]);
    await expect(repositories.exercises.listAll()).resolves.toMatchObject([
      { name: "Supino reto" },
    ]);
    await expect(repositories.profile.get()).resolves.toMatchObject({
      id: PROFILE_ID,
    });
  });

  it("round-trips through JSON.stringify/parse, not just the in-memory object", async () => {
    const repositories = await getRepositories();
    await repositories.diets.save(createDiet("Bulking"), null);

    const backup = await exportAll();
    const serialized = JSON.stringify(backup);

    await clearAllStores();
    const result = await importAll(serialized);

    expect(result).toMatchObject({ ok: true });
    await expect(repositories.diets.listAll()).resolves.toMatchObject([
      { name: "Bulking" },
    ]);
  });

  it("rejects a file that is not valid JSON, and leaves existing data untouched", async () => {
    const repositories = await getRepositories();
    await repositories.diets.save(createDiet("Keep me"), null);

    const result = await importAll("{ not json at all");

    expect(result).toEqual({ ok: false, reason: "invalid" });
    await expect(repositories.diets.listAll()).resolves.toMatchObject([
      { name: "Keep me" },
    ]);
  });

  it("rejects a corrupted envelope (right JSON, wrong shape), and leaves existing data untouched", async () => {
    const repositories = await getRepositories();
    await repositories.diets.save(createDiet("Keep me"), null);

    const malformed = { schemaVersion: 1, exportedAt: Date.now() }; // no `stores`

    const result = await importAll(malformed);

    expect(result).toEqual({ ok: false, reason: "invalid" });
    await expect(repositories.diets.listAll()).resolves.toMatchObject([
      { name: "Keep me" },
    ]);
  });

  it("rejects a file with records missing the base entity shape", async () => {
    const repositories = await getRepositories();
    await repositories.diets.save(createDiet("Keep me"), null);

    const backup = await exportAll();
    const corrupted = {
      ...backup,
      stores: {
        ...backup.stores,
        diets: [{ name: "sem id, sem datas" }],
      },
    };

    const result = await importAll(corrupted);

    expect(result).toEqual({ ok: false, reason: "invalid" });
    await expect(repositories.diets.listAll()).resolves.toMatchObject([
      { name: "Keep me" },
    ]);
  });

  it("rejects a file from an incompatible schema version, and leaves existing data untouched", async () => {
    const repositories = await getRepositories();
    await repositories.diets.save(createDiet("Keep me"), null);

    const backup = await exportAll();
    const fromTheFuture = { ...backup, schemaVersion: 999 };

    const result = await importAll(fromTheFuture);

    expect(result).toEqual({ ok: false, reason: "incompatible" });
    await expect(repositories.diets.listAll()).resolves.toMatchObject([
      { name: "Keep me" },
    ]);
  });

  describe("previewImport", () => {
    it("counts records without writing anything — the H.2 confirmation step", async () => {
      const repositories = await getRepositories();
      await repositories.diets.save(createDiet("Untouched"), null);

      const backup = await exportAll(); // one diet, nothing else
      const preview = previewImport(backup);

      expect(preview).toEqual({ ok: true, recordCount: 1 });
      // Not a second copy of "Untouched" — the database was never touched.
      await expect(repositories.diets.listAll()).resolves.toMatchObject([
        { name: "Untouched" },
      ]);
    });

    it("names a technically valid but empty backup as 0 records, rather than blocking it", async () => {
      const emptyBackup = {
        schemaVersion: BACKUP_FORMAT_VERSION,
        exportedAt: Date.now(),
        stores: {
          body: [],
          foodLogs: [],
          foods: [],
          diets: [],
          profile: [],
          exercises: [],
          routines: [],
          sessions: [],
        },
      };

      expect(previewImport(emptyBackup)).toEqual({ ok: true, recordCount: 0 });
    });

    it("reports the same validation failures importAll would, on the same inputs", () => {
      expect(previewImport("{ not json at all")).toEqual({
        ok: false,
        reason: "invalid",
      });
      expect(previewImport({ schemaVersion: 999 })).toEqual({
        ok: false,
        reason: "invalid", // no `stores` at all — fails shape before version
      });
    });
  });

  it("a full import replaces rather than merges — an empty backup clears the database", async () => {
    const repositories = await getRepositories();
    await repositories.diets.save(createDiet("Will be replaced"), null);

    const emptyBackup = {
      schemaVersion: BACKUP_FORMAT_VERSION,
      exportedAt: Date.now(),
      stores: {
        body: [],
        foodLogs: [],
        foods: [],
        diets: [],
        profile: [],
        exercises: [],
        routines: [],
        sessions: [],
      },
    };

    const result = await importAll(emptyBackup);

    expect(result).toEqual({ ok: true, recordCount: 0 });
    await expect(repositories.diets.listAll()).resolves.toEqual([]);
  });
});
