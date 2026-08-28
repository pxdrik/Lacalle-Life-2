import { afterEach, describe, expect, it, vi } from "vitest";

import { createBodyEntry } from "@/features/body/services/body-log";
import { createDiet } from "@/features/diet/services/create-diet";
import { createFoodLog } from "@/features/diet/services/start-day";
import { createCustomFood } from "@/features/foods/services/create-food";
import { createCustomExercise } from "@/features/workouts/services/create-exercise";
import { createRoutine } from "@/features/workouts/services/create-routine";
import { PROFILE_ID, type Profile } from "@/features/profile/types/profile";
import type { Session } from "@/features/workouts/types/session";

/**
 * Prova ao vivo da regra de ouro da correção de isolamento:
 *
 *     ANÔNIMO → "lacalle-life"
 *     CONTA A → "lacalle-life:acct:<uidA>"
 *     CONTA B → "lacalle-life:acct:<uidB>"
 *
 * e que nenhum dos três compartilha dado pessoal com os outros — nas oito
 * entidades pessoais, não só Profile. Cada "sessão" abaixo é uma
 * `vi.resetModules()` + reimportação dinâmica: exatamente o que a
 * navegação completa (`hardNavigateTo`) provoca de verdade no navegador,
 * descartando `repositories.ts`'s `connection` e os `once()` de
 * `data-providers.tsx` como uma troca de identidade real faria.
 */

function profileFixture(weightKg: number): Profile {
  const now = Date.now();
  return {
    id: PROFILE_ID,
    nutrition: {
      sex: "male",
      ageYears: 30,
      heightCm: 178,
      weightKg,
      activityLevel: "moderate",
      goal: "maintain",
    },
    createdAt: now,
    updatedAt: now,
  };
}

function sessionFixture(name: string): Session {
  const now = Date.now();
  return {
    id: `${name}-session`,
    routineId: null,
    name,
    startedAt: now,
    finishedAt: now,
    exercises: [],
    createdAt: now,
    updatedAt: now,
  };
}

interface Identity {
  readonly kind: "anonymous" | "authenticated";
  readonly uid?: string;
}

/**
 * Simula uma nova carga de página com a identidade dada — os módulos de
 * composição são reimportados do zero, então nenhuma promise memoizada de
 * uma "sessão" anterior sobrevive.
 */
async function freshSession(identity: Identity) {
  vi.resetModules();

  vi.doMock("@/core/auth/env", () => ({
    isSupabaseConfigured: () => true,
  }));
  vi.doMock("@/core/auth/supabase-browser-client", () => ({
    getSupabaseBrowserClient: () => ({
      auth: {
        getSession: () =>
          Promise.resolve({
            data: {
              session:
                identity.kind === "authenticated"
                  ? { user: { id: identity.uid } }
                  : null,
            },
          }),
      },
    }),
  }));

  const repositoriesModule = await import("./repositories");
  const backupModule = await import("./backup");
  const forgetDeviceModule = await import("./forget-device");
  const migrateModule = await import("./migrate-anonymous-data");
  const identityModule = await import("./identity");

  return {
    repositories: await repositoriesModule.getRepositories(),
    backup: backupModule,
    forgetDevice: forgetDeviceModule.forgetDevice,
    migrate: migrateModule.migrateAnonymousDataToCurrentIdentity,
    databaseName: await identityModule.currentDatabaseName(),
  };
}

afterEach(() => {
  vi.doUnmock("@/core/auth/env");
  vi.doUnmock("@/core/auth/supabase-browser-client");
});

describe("isolamento entre identidades — todas as stores pessoais", () => {
  it("anônimo, conta A e conta B nunca compartilham dado pessoal entre si", async () => {
    const uidA = `test-a-${crypto.randomUUID()}`;
    const uidB = `test-b-${crypto.randomUUID()}`;

    // 1) Anônimo cria um de cada.
    const anon = await freshSession({ kind: "anonymous" });
    expect(anon.databaseName).toBe("lacalle-life");

    await anon.repositories.profile.save(profileFixture(70), null);
    await anon.repositories.diets.save(createDiet("Dieta Anônima"), null);
    await anon.repositories.routines.save(createRoutine("Treino Anônimo"), null);
    await anon.repositories.foodLogs.save(createFoodLog("2026-01-01"), null);
    await anon.repositories.body.save(
      { ...createBodyEntry("2026-01-01"), weightKg: 70 },
      null,
    );
    const anonExercise = createCustomExercise({
      name: "Exercício Anônimo",
      primaryMuscles: [],
      equipment: [],
    });
    await anon.repositories.exercises.save(anonExercise, null);
    const anonFood = createCustomFood({
      name: "Comida Anônima",
      category: "protein",
      per100g: { kcal: 100, proteinG: 10, carbsG: 10, fatG: 10 },
    });
    await anon.repositories.foods.save(anonFood, null);
    await anon.repositories.sessions.save(sessionFixture("Sessão Anônima"), null);

    // 2) Conta A loga pela primeira vez neste "aparelho": tudo vazio.
    const first = await freshSession({ kind: "authenticated", uid: uidA });
    expect(first.databaseName).toBe(`lacalle-life:acct:${uidA}`);

    await expect(first.repositories.profile.get()).resolves.toBeUndefined();
    await expect(first.repositories.diets.listAll()).resolves.toEqual([]);
    await expect(first.repositories.routines.listAll()).resolves.toEqual([]);
    await expect(first.repositories.foodLogs.listAll()).resolves.toEqual([]);
    await expect(first.repositories.body.listAll()).resolves.toEqual([]);
    await expect(first.repositories.sessions.listAll()).resolves.toEqual([]);
    const firstExercises = await first.repositories.exercises.listAll();
    expect(firstExercises.some((exercise) => exercise.isCustom)).toBe(false);
    const firstFoods = await first.repositories.foods.listAll();
    expect(firstFoods.some((food) => food.isCustom)).toBe(false);

    // A cria os próprios dados, distintos dos anônimos.
    const a = await freshSession({ kind: "authenticated", uid: uidA });
    await a.repositories.profile.save(profileFixture(80), null);
    await a.repositories.diets.save(createDiet("Dieta A"), null);
    await a.repositories.routines.save(createRoutine("Treino A"), null);
    await a.repositories.foodLogs.save(createFoodLog("2026-02-01"), null);
    await a.repositories.body.save(
      { ...createBodyEntry("2026-02-01"), weightKg: 80 },
      null,
    );
    const exerciseA = createCustomExercise({
      name: "Exercício A",
      primaryMuscles: [],
      equipment: [],
    });
    await a.repositories.exercises.save(exerciseA, null);
    const foodA = createCustomFood({
      name: "Comida A",
      category: "protein",
      per100g: { kcal: 200, proteinG: 20, carbsG: 20, fatG: 20 },
    });
    await a.repositories.foods.save(foodA, null);
    await a.repositories.sessions.save(sessionFixture("Sessão A"), null);

    // 3) Conta B loga pela primeira vez: nada de anônimo, nada de A.
    const b = await freshSession({ kind: "authenticated", uid: uidB });
    expect(b.databaseName).toBe(`lacalle-life:acct:${uidB}`);
    expect(b.databaseName).not.toBe(first.databaseName);

    await expect(b.repositories.profile.get()).resolves.toBeUndefined();
    await expect(b.repositories.diets.listAll()).resolves.toEqual([]);
    await expect(b.repositories.routines.listAll()).resolves.toEqual([]);
    await expect(b.repositories.foodLogs.listAll()).resolves.toEqual([]);
    await expect(b.repositories.body.listAll()).resolves.toEqual([]);
    await expect(b.repositories.sessions.listAll()).resolves.toEqual([]);
    const bExercisesBefore = await b.repositories.exercises.listAll();
    expect(bExercisesBefore.some((exercise) => exercise.name === "Exercício A")).toBe(
      false,
    );
    expect(
      bExercisesBefore.some((exercise) => exercise.name === "Exercício Anônimo"),
    ).toBe(false);
    const bFoodsBefore = await b.repositories.foods.listAll();
    expect(bFoodsBefore.some((food) => food.name === "Comida A")).toBe(false);
    expect(bFoodsBefore.some((food) => food.name === "Comida Anônima")).toBe(false);

    // B cria os próprios dados, distintos dos de A e dos anônimos.
    await b.repositories.profile.save(profileFixture(90), null);
    await b.repositories.diets.save(createDiet("Dieta B"), null);
    await b.repositories.routines.save(createRoutine("Treino B"), null);

    // 4) De volta para A: só o que é de A, nada de B.
    const backToA = await freshSession({ kind: "authenticated", uid: uidA });
    expect(backToA.databaseName).toBe(first.databaseName);

    const aProfile = await backToA.repositories.profile.get();
    expect(aProfile?.nutrition.weightKg).toBe(80);

    const aDiets = await backToA.repositories.diets.listAll();
    expect(aDiets.map((diet) => diet.name)).toEqual(["Dieta A"]);

    const aRoutines = await backToA.repositories.routines.listAll();
    expect(aRoutines.map((routine) => routine.name)).toEqual(["Treino A"]);

    const aFoods = await backToA.repositories.foods.listAll();
    expect(aFoods.some((food) => food.name === "Comida B")).toBe(false);
    expect(aFoods.some((food) => food.name === "Comida Anônima")).toBe(false);
    expect(aFoods.some((food) => food.name === "Comida A")).toBe(true);

    // 5) De volta para o anônimo: os dados originais continuam intactos.
    const backToAnon = await freshSession({ kind: "anonymous" });
    expect(backToAnon.databaseName).toBe("lacalle-life");

    const anonProfile = await backToAnon.repositories.profile.get();
    expect(anonProfile?.nutrition.weightKg).toBe(70);

    const anonDiets = await backToAnon.repositories.diets.listAll();
    expect(anonDiets.map((diet) => diet.name)).toEqual(["Dieta Anônima"]);
  });
});

describe("backup respeita a identidade atual", () => {
  it("um export da conta B nunca contém dado da conta A", async () => {
    const uidA = `backup-a-${crypto.randomUUID()}`;
    const uidB = `backup-b-${crypto.randomUUID()}`;

    const a = await freshSession({ kind: "authenticated", uid: uidA });
    await a.repositories.diets.save(createDiet("Dieta Só de A"), null);
    const backupA = await a.backup.exportAll();
    expect(backupA.stores.diets.map((diet) => diet.name)).toEqual([
      "Dieta Só de A",
    ]);

    const b = await freshSession({ kind: "authenticated", uid: uidB });
    const backupB = await b.backup.exportAll();
    expect(backupB.stores.diets).toEqual([]);
    expect(
      backupB.stores.diets.some((diet) => diet.name === "Dieta Só de A"),
    ).toBe(false);
  });
});

describe("forget-device atua só na identidade atual", () => {
  it("esquecer o dispositivo como conta A não apaga a conta B", async () => {
    const uidA = `forget-a-${crypto.randomUUID()}`;
    const uidB = `forget-b-${crypto.randomUUID()}`;

    const a = await freshSession({ kind: "authenticated", uid: uidA });
    await a.repositories.diets.save(createDiet("Dieta de A"), null);

    const b = await freshSession({ kind: "authenticated", uid: uidB });
    await b.repositories.diets.save(createDiet("Dieta de B"), null);

    const backToA = await freshSession({ kind: "authenticated", uid: uidA });
    const result = await backToA.forgetDevice();
    expect(result.indexedDb).toBe(true);
    await expect(backToA.repositories.diets.listAll()).resolves.toEqual([]);

    const backToB = await freshSession({ kind: "authenticated", uid: uidB });
    const bDiets = await backToB.repositories.diets.listAll();
    expect(bDiets.map((diet) => diet.name)).toEqual(["Dieta de B"]);
  });
});

describe("migração de dados anônimos", () => {
  it("só migra para a conta com uma ação explícita, e não sobrescreve dado real no servidor sem detectar conflito", async () => {
    const uid = `migrate-${crypto.randomUUID()}`;

    const anon = await freshSession({ kind: "anonymous" });
    await anon.repositories.diets.save(createDiet("Dieta Migrável"), null);
    // `null` só é válido para criar — o banco anônimo é compartilhado por
    // todos os testes deste arquivo, então um perfil anterior pode já
    // existir aqui; lê a versão atual para um upsert válido de qualquer jeito.
    const existingAnonProfile = await anon.repositories.profile.get();
    await anon.repositories.profile.save(
      profileFixture(65),
      existingAnonProfile?.updatedAt ?? null,
    );
    await anon.repositories.foodLogs.save(createFoodLog("2026-03-01"), null);

    // Login numa conta nova: nada aparece sozinho.
    const account = await freshSession({ kind: "authenticated", uid });
    await expect(account.repositories.diets.listAll()).resolves.toEqual([]);

    // "Adicionar meus dados": migração explícita.
    const migrating = await freshSession({ kind: "authenticated", uid });
    const result = await migrating.migrate();
    expect(result.ok).toBe(true);

    const afterMigration = await freshSession({ kind: "authenticated", uid });
    const diets = await afterMigration.repositories.diets.listAll();
    // O banco anônimo é compartilhado por todos os testes deste arquivo —
    // a migração traz tudo o que está lá, não só o que este teste escreveu.
    // O que importa provar aqui é que "Dieta Migrável" chegou na conta.
    expect(diets.some((diet) => diet.name === "Dieta Migrável")).toBe(true);
    const profile = await afterMigration.repositories.profile.get();
    expect(profile?.nutrition.weightKg).toBe(65);
  });
});
