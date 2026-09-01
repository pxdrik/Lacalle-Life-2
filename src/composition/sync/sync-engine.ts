import { getSupabaseBrowserClient } from "@/core/auth/supabase-browser-client";
import { openDatabase } from "@/core/storage/indexeddb/database";
import { IndexedDbStore } from "@/core/storage/indexeddb/indexeddb-store";
import { SYNC_TRACKER_STORE, type SyncTracker } from "@/core/sync/sync-tracker";
import { DIETS_STORE } from "@/features/diet/data/diet-store";
import { LocalDietRepository } from "@/features/diet/data/local-diet-repository";
import { LocalFoodLogRepository } from "@/features/diet/data/local-food-log-repository";
import { FOOD_LOGS_STORE } from "@/features/diet/data/food-log-repository";
import type { Diet } from "@/features/diet/types/diet";
import type { FoodLog } from "@/features/diet/types/food-log";
import { LocalProfileRepository } from "@/features/profile/data/local-profile-repository";
import { PROFILE_STORE } from "@/features/profile/data/profile-repository";
import type { Profile } from "@/features/profile/types/profile";
import { LocalRoutineRepository, ROUTINES_STORE } from "@/features/workouts/data/routine-repository";
import type { Routine } from "@/features/workouts/types/routine";

import { currentDatabaseName } from "../identity";
import { MIGRATIONS } from "../migrations";
import { pullAllDiets, pushAllDiets, resolveDietConflict } from "./diet-sync";
import type {
  DietConflictResolution,
  PullDietsResult,
  PushDietsResult,
} from "./diet-sync";
import {
  pullFoodLog,
  pushFoodLog,
  resolveFoodLogConflict,
} from "./food-log-sync";
import type {
  FoodLogConflictResolution,
  PullFoodLogResult,
  PushFoodLogResult,
} from "./food-log-sync";
import type { MealConflict } from "./food-log-merge";
import { pullProfile, pushProfile, resolveProfileConflict } from "./profile-sync";
import type {
  ProfileConflictResolution,
  PullProfileResult,
  PushProfileResult,
} from "./profile-sync";
import { pullAllRoutines, pushAllRoutines, resolveRoutineConflict } from "./routine-sync";
import type {
  RoutineConflictResolution,
  PullRoutinesResult,
  PushRoutinesResult,
} from "./routine-sync";

export interface ProfileSyncOutcome {
  readonly push: PushProfileResult;
  readonly pull: PullProfileResult;
}

async function openProfileSyncStores() {
  const db = await openDatabase(await currentDatabaseName(), MIGRATIONS);
  const tracker = new IndexedDbStore<SyncTracker>(db, SYNC_TRACKER_STORE.name);
  const localOnly = new LocalProfileRepository(
    new IndexedDbStore<Profile>(db, PROFILE_STORE.name),
  );
  return { tracker, localOnly };
}

/**
 * Sincroniza `profile` uma vez: empurra a edição local pendente, se houver,
 * depois traz o que o servidor tem. `push` primeiro garante que uma edição
 * local não sincronizada tenta subir antes de qualquer `pull` — embora
 * `pullProfile` já se recuse a sobrescrever uma pendência de qualquer jeito
 * (a ordem é defesa em profundidade, não a única proteção).
 *
 * Sem autenticação, as duas funções voltam `"not-authenticated"` sem
 * lançar — chamar isto num app sem sessão é seguro e não faz nada.
 *
 * Abre o `LocalProfileRepository` **puro** (nunca o `SyncingProfileRepository`
 * usado pela UI) — ver a doc de `pushProfile`/`pullProfile` sobre por quê.
 */
export async function runProfileSync(): Promise<ProfileSyncOutcome> {
  const supabase = getSupabaseBrowserClient();
  const { tracker, localOnly } = await openProfileSyncStores();

  const push = await pushProfile(supabase, tracker, localOnly);
  const pull = await pullProfile(supabase, tracker, localOnly);

  return { push, pull };
}

/**
 * Única forma de destravar um `Profile` em conflito. `remote` tem que vir
 * do resultado `"conflict"` que a UI mostrou na tela — nunca busca de novo
 * aqui, para nunca resolver um par de valores diferente do que o usuário
 * viu ao decidir. Depois de resolver, roda `runProfileSync` de novo para
 * completar o ciclo (enviar, se "manter local"; nada a enviar, se "usar
 * servidor").
 */
export async function resolveProfileConflictAndSync(
  resolution: ProfileConflictResolution,
  remote: Profile,
): Promise<ProfileSyncOutcome> {
  const { tracker, localOnly } = await openProfileSyncStores();
  await resolveProfileConflict(tracker, localOnly, resolution, remote);
  return runProfileSync();
}

export interface FoodLogSyncOutcome {
  readonly push: PushFoodLogResult;
  readonly pull: PullFoodLogResult;
}

async function openFoodLogSyncStores() {
  const db = await openDatabase(await currentDatabaseName(), MIGRATIONS);
  const tracker = new IndexedDbStore<SyncTracker>(db, SYNC_TRACKER_STORE.name);
  const localOnly = new LocalFoodLogRepository(
    new IndexedDbStore<FoodLog>(db, FOOD_LOGS_STORE.name),
  );
  return { tracker, localOnly };
}

/**
 * Sincroniza um dia do `FoodLog` uma vez — mesmo desenho de
 * `runProfileSync`: push da pendência local, depois pull do que o
 * servidor tem. Abre o `LocalFoodLogRepository` **puro**, nunca o
 * `SyncingFoodLogRepository` que a UI usa — ver a doc de
 * `pushFoodLog`/`pullFoodLog` sobre por quê.
 */
export async function runFoodLogSync(day: string): Promise<FoodLogSyncOutcome> {
  const supabase = getSupabaseBrowserClient();
  const { tracker, localOnly } = await openFoodLogSyncStores();

  const push = await pushFoodLog(supabase, tracker, localOnly, day);
  const pull = await pullFoodLog(supabase, tracker, localOnly, day);

  return { push, pull };
}

/**
 * Resolve um subconjunto dos conflitos de um dia e roda o ciclo de novo.
 * `conflicts` e as escolhas em `resolutions` têm que vir do resultado
 * `"conflict"` que a UI mostrou — mesma regra do `resolveFoodLogConflict`
 * que esta função só encapsula.
 */
export async function resolveFoodLogConflictAndSync(
  day: string,
  conflicts: readonly MealConflict[],
  resolutions: ReadonlyMap<string, FoodLogConflictResolution>,
): Promise<FoodLogSyncOutcome> {
  const { tracker, localOnly } = await openFoodLogSyncStores();
  await resolveFoodLogConflict(tracker, localOnly, day, conflicts, resolutions);
  return runFoodLogSync(day);
}

export interface DietSyncOutcome {
  readonly push: PushDietsResult;
  readonly pull: PullDietsResult;
}

async function openDietSyncStores() {
  const db = await openDatabase(await currentDatabaseName(), MIGRATIONS);
  const tracker = new IndexedDbStore<SyncTracker>(db, SYNC_TRACKER_STORE.name);
  const localOnly = new LocalDietRepository(new IndexedDbStore<Diet>(db, DIETS_STORE.name));
  return { tracker, localOnly };
}

/**
 * Sincroniza todas as dietas de uma vez — mesmo desenho de
 * `runProfileSync`/`runFoodLogSync`: push de toda pendência, depois pull de
 * tudo que o servidor tem. Diferente das outras duas, `push`/`pull` aqui
 * cobrem um lote de registros, não um só — ver a doc de `pushAllDiets`/
 * `pullAllDiets` sobre por quê. Abre o `LocalDietRepository` **puro**,
 * nunca o `SyncingDietRepository` que a UI usa.
 */
export async function runDietSync(): Promise<DietSyncOutcome> {
  const supabase = getSupabaseBrowserClient();
  const { tracker, localOnly } = await openDietSyncStores();

  const push = await pushAllDiets(supabase, tracker, localOnly);
  const pull = await pullAllDiets(supabase, tracker, localOnly);

  return { push, pull };
}

/**
 * Resolve o conflito de uma dieta e roda o ciclo de novo. `dietId`/`remote`
 * têm que vir do resultado `"done"` de `runDietSync` que a UI mostrou —
 * mesma regra de `resolveProfileConflictAndSync`/`resolveFoodLogConflictAndSync`.
 */
export async function resolveDietConflictAndSync(
  dietId: string,
  resolution: DietConflictResolution,
  remote: Diet | null,
): Promise<DietSyncOutcome> {
  const { tracker, localOnly } = await openDietSyncStores();
  await resolveDietConflict(tracker, localOnly, dietId, resolution, remote);
  return runDietSync();
}

export interface RoutineSyncOutcome {
  readonly push: PushRoutinesResult;
  readonly pull: PullRoutinesResult;
}

async function openRoutineSyncStores() {
  const db = await openDatabase(await currentDatabaseName(), MIGRATIONS);
  const tracker = new IndexedDbStore<SyncTracker>(db, SYNC_TRACKER_STORE.name);
  const localOnly = new LocalRoutineRepository(
    new IndexedDbStore<Routine>(db, ROUTINES_STORE.name),
  );
  return { tracker, localOnly };
}

/**
 * Sincroniza todas as rotinas de uma vez — mesmo desenho de `runDietSync`,
 * mesma família de "muitos registros por usuário". Abre o
 * `LocalRoutineRepository` **puro**, nunca o `SyncingRoutineRepository` que
 * a UI usa.
 */
export async function runRoutineSync(): Promise<RoutineSyncOutcome> {
  const supabase = getSupabaseBrowserClient();
  const { tracker, localOnly } = await openRoutineSyncStores();

  const push = await pushAllRoutines(supabase, tracker, localOnly);
  const pull = await pullAllRoutines(supabase, tracker, localOnly);

  return { push, pull };
}

/**
 * Resolve o conflito de uma rotina e roda o ciclo de novo. `routineId`/
 * `remote` têm que vir do resultado `"done"` de `runRoutineSync` que a UI
 * mostrou — mesma regra de `resolveDietConflictAndSync`.
 */
export async function resolveRoutineConflictAndSync(
  routineId: string,
  resolution: RoutineConflictResolution,
  remote: Routine | null,
): Promise<RoutineSyncOutcome> {
  const { tracker, localOnly } = await openRoutineSyncStores();
  await resolveRoutineConflict(tracker, localOnly, routineId, resolution, remote);
  return runRoutineSync();
}
