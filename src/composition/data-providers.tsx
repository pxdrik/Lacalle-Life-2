"use client";

import type { BodyRepository } from "@/features/body/data/body-repository";
import { BodyRepositoryProvider } from "@/features/body/data/body-repository-context";
import { SyncingBodyRepository } from "@/features/body/data/syncing-body-repository";
import { DietRepositoryProvider } from "@/features/diet/data/diet-repository-context";
import type { FoodLogRepository } from "@/features/diet/data/food-log-repository";
import { FoodLogRepositoryProvider } from "@/features/diet/data/food-log-repository-context";
import { SyncingFoodLogRepository } from "@/features/diet/data/syncing-food-log-repository";
import { SyncingDietRepository } from "@/features/diet/data/syncing-diet-repository";
import type { DietRepository } from "@/features/diet/data/diet-repository";
import { FoodRepositoryProvider } from "@/features/foods/data/food-repository-context";
import type { FoodRepository } from "@/features/foods/data/food-repository";
import { BackupRepositoryProvider } from "@/features/profile/data/backup-repository-context";
import type {
  BackupRepository,
  ForgetDeviceResult,
} from "@/features/profile/data/backup-repository";
import { ProfileRepositoryProvider } from "@/features/profile/data/profile-repository-context";
import type { ProfileRepository } from "@/features/profile/data/profile-repository";
import { SyncingProfileRepository } from "@/features/profile/data/syncing-profile-repository";
import type { ExerciseRepository } from "@/features/workouts/data/exercise-repository";
import { ExerciseRepositoryProvider } from "@/features/workouts/data/exercise-repository-context";
import { SyncingRoutineRepository } from "@/features/workouts/data/syncing-routine-repository";
import { SyncingSessionRepository } from "@/features/workouts/data/syncing-session-repository";
import {
  WorkoutRepositoryProvider,
  type WorkoutRepositories,
} from "@/features/workouts/data/workout-repository-context";

import { getSupabaseBrowserClient } from "@/core/auth/supabase-browser-client";
import { openDatabase } from "@/core/storage/indexeddb/database";
import { IndexedDbStore } from "@/core/storage/indexeddb/indexeddb-store";
import {
  backfillUntracked,
  SYNC_TRACKER_STORE,
  type SyncTracker,
} from "@/core/sync/sync-tracker";
import { PROFILE_ID } from "@/features/profile/types/profile";

import { exportAll, importAll, previewImport } from "./backup";
import { debouncedKeyedTrigger, debouncedTrigger } from "./debounce";
import { forgetDevice as forgetDeviceDetailed } from "./forget-device";
import { currentDatabaseName } from "./identity";
import { MIGRATIONS } from "./migrations";
import { getRepositories } from "./repositories";
import { pushAllDiets } from "./sync/diet-sync";
import { pushFoodLog } from "./sync/food-log-sync";
import { pushProfile } from "./sync/profile-sync";
import { pushAllRoutines } from "./sync/routine-sync";
import { pushAllSessions } from "./sync/session-sync";
import { pushAllBodyEntries } from "./sync/body-entry-sync";

/**
 * Supplies each feature with its repository.
 *
 * This is the only module that knows those repositories are backed by
 * IndexedDB. Pointing a feature at a remote implementation is a change here
 * and in `repositories.ts` — nothing inside `features/` moves.
 */

/**
 * Resolves once and hands back the same promise, so the context value is a
 * stable reference and consuming effects do not re-run on every render.
 *
 * A rejection is not cached: `getRepositories` allows a retry after a
 * transient failure, and holding a rejected promise here would defeat that.
 */
function once<T>(resolve: () => Promise<T>): () => Promise<T> {
  let cached: Promise<T> | undefined;

  return () => {
    cached ??= resolve().catch((error: unknown) => {
      cached = undefined;
      throw error;
    });

    return cached;
  };
}

/**
 * Espera uma pausa nas escritas antes de tentar um push — achado ao vivo
 * contra o Supabase real: sem isto, o push só acontecia quando a tela de
 * sincronização (re)montava, e quem editava e trocava de aparelho antes de
 * reabrir aquela tela nunca via a edição chegar no outro lado (ver a doc de
 * cada `Syncing*Repository`). Curto o bastante para não atrasar quem sai da
 * tela logo após editar; longo o bastante para uma rajada de campos
 * salvando um por um (o editor de dieta/rotina não debounça a escrita
 * local, de propósito — ver a doc de `use-diet-editor.ts`) colapsar num
 * push só, em vez de um por campo.
 *
 * Era 1500ms — achado do Pedro (02/09/2026): esperar a tela de carregamento
 * do outro aparelho não adianta nada se o atraso está aqui, do lado de quem
 * *enviou*. Trocar de aparelho rápido demais depois de editar significava
 * que o push nem tinha saído ainda quando o outro lado tentava puxar —
 * "sincronizar" no segundo aparelho buscava e não achava nada novo porque,
 * de fato, ainda não havia nada novo lá. Baixado para encolher essa janela
 * de corrida; ainda alto o bastante para colapsar uma rajada de campos.
 */
const PUSH_DEBOUNCE_MS = 400;

/**
 * Decorado com o outbox de sync (`SyncingBodyRepository`), mesmo motivo do
 * `dietRepository`/`profileRepository` acima.
 */
const bodyRepository = once<BodyRepository>(async () => {
  const local = (await getRepositories()).body;
  const db = await openDatabase(await currentDatabaseName(), MIGRATIONS);
  const tracker = new IndexedDbStore<SyncTracker>(db, SYNC_TRACKER_STORE.name);
  const existing = await local.listAll();
  await backfillUntracked(tracker, "bodyEntries", existing.map((entry) => entry.id));
  const pushSoon = debouncedTrigger(() => {
    pushAllBodyEntries(getSupabaseBrowserClient(), tracker, local).catch(() => {
      // Silencioso de propósito — ver `foodLogRepository` abaixo.
    });
  }, PUSH_DEBOUNCE_MS);
  return new SyncingBodyRepository(local, tracker, pushSoon);
});

export function BodyDataProvider({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  return (
    <BodyRepositoryProvider repository={bodyRepository()}>
      {children}
    </BodyRepositoryProvider>
  );
}

const foodRepository = once<FoodRepository>(async () => {
  return (await getRepositories()).foods;
});

/**
 * Decorado com o outbox de sync, mesmo motivo do `profileRepository`
 * abaixo — a UI nunca sabe que sync existe.
 */
const foodLogRepository = once<FoodLogRepository>(async () => {
  const local = (await getRepositories()).foodLogs;
  const db = await openDatabase(await currentDatabaseName(), MIGRATIONS);
  const tracker = new IndexedDbStore<SyncTracker>(db, SYNC_TRACKER_STORE.name);
  // Pega registros salvos antes deste dispositivo ter sync — ver a doc de
  // `backfillUntracked`. Roda uma vez por sessão (`once<T>` memoiza esta
  // fábrica), custo desprezível mesmo com centenas de dias registrados.
  const existing = await local.listAll();
  await backfillUntracked(tracker, "foodLog", existing.map((log) => log.id));
  const pushSoon = debouncedKeyedTrigger((day) => {
    pushFoodLog(getSupabaseBrowserClient(), tracker, local, day).catch(() => {
      // Silencioso de propósito — o próximo mount de `/diario` ou o botão
      // manual tentam de novo e mostram erro de verdade, se houver um.
    });
  }, PUSH_DEBOUNCE_MS);
  return new SyncingFoodLogRepository(local, tracker, pushSoon);
});

/**
 * The food log needs the foods (to add one to a meal), the diets (to start a
 * day from one) and the profile (to compare the day against a target).
 *
 * **The profile is the one that was missed, and it failed silently.**
 * `useNutritionTargets` reads through `useOptionalProfileRepository`, which
 * returns null without a provider rather than throwing — the design that keeps
 * the diet editor working for someone who never filled a profile in. Here that
 * same tolerance turned a wiring mistake into "the targets just never show
 * up", on the screen whose whole point is comparing what was eaten to a goal.
 */
export function FoodLogDataProvider({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  return (
    <FoodLogRepositoryProvider repository={foodLogRepository()}>
      <DietRepositoryProvider repository={dietRepository()}>
        <FoodRepositoryProvider repository={foodRepository()}>
          <ProfileRepositoryProvider repository={profileRepository()}>
            {children}
          </ProfileRepositoryProvider>
        </FoodRepositoryProvider>
      </DietRepositoryProvider>
    </FoodLogRepositoryProvider>
  );
}

/**
 * Decorado com o outbox de sync (`SyncingDietRepository`), mesmo motivo do
 * `profileRepository`/`foodLogRepository` acima.
 */
const dietRepository = once<DietRepository>(async () => {
  const local = (await getRepositories()).diets;
  const db = await openDatabase(await currentDatabaseName(), MIGRATIONS);
  const tracker = new IndexedDbStore<SyncTracker>(db, SYNC_TRACKER_STORE.name);
  const existing = await local.listAll();
  await backfillUntracked(tracker, "diets", existing.map((diet) => diet.id));
  const pushSoon = debouncedTrigger(() => {
    pushAllDiets(getSupabaseBrowserClient(), tracker, local).catch(() => {
      // Silencioso de propósito — ver `foodLogRepository` acima.
    });
  }, PUSH_DEBOUNCE_MS);
  return new SyncingDietRepository(local, tracker, pushSoon);
});

/**
 * Decorado com o outbox de sync (`SyncingProfileRepository`) — toda escrita
 * grava local primeiro, exatamente como antes, e também marca uma
 * pendência de envio. Sem conta logada isso é inofensivo: a pendência fica
 * gravada e nunca é drenada, porque `pushProfile` devolve
 * `"not-authenticated"` sem fazer nada. Uma segunda conexão ao mesmo banco,
 * separada da que `getRepositories()` já abre — `idb` permite múltiplas
 * conexões simultâneas à mesma versão sem conflito.
 */
const profileRepository = once<ProfileRepository>(async () => {
  const local = (await getRepositories()).profile;
  const db = await openDatabase(await currentDatabaseName(), MIGRATIONS);
  const tracker = new IndexedDbStore<SyncTracker>(db, SYNC_TRACKER_STORE.name);
  const existing = await local.get();
  if (existing !== undefined) {
    await backfillUntracked(tracker, "profile", [PROFILE_ID]);
  }
  const pushSoon = debouncedTrigger(() => {
    pushProfile(getSupabaseBrowserClient(), tracker, local).catch(() => {
      // Silencioso de propósito — ver `foodLogRepository` acima.
    });
  }, PUSH_DEBOUNCE_MS);
  return new SyncingProfileRepository(local, tracker, pushSoon);
});

/**
 * Narrows `forgetDeviceDetailed`'s per-mechanism result to what
 * `BackupRepository` exposes — see that type's own doc comment for why the
 * feature-facing contract stays a plain ok/partial shape rather than naming
 * `caches`/`serviceWorker`/`indexedDb` individually: those are composition's
 * concern, not the screen's.
 */
async function forgetDevice(): Promise<ForgetDeviceResult> {
  const detailed = await forgetDeviceDetailed();
  const values = Object.values(detailed);

  if (values.every(Boolean)) return { ok: true };

  return { ok: false, partiallyCompleted: values.some(Boolean) };
}

const backupRepository = once<BackupRepository>(() =>
  Promise.resolve({
    exportAll,
    importAll,
    previewImport: (raw: string) => Promise.resolve(previewImport(raw)),
    forgetDevice,
  }),
);

const exerciseRepository = once<ExerciseRepository>(async () => {
  return (await getRepositories()).exercises;
});

/**
 * The profile screen also reads the body log, to notice when the weight behind
 * someone's targets has gone stale. Composed here rather than nested at the
 * route, so a page never has to know which repositories a screen's components
 * happen to reach for.
 */
export function ProfileScreenDataProvider({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  return (
    <ProfileDataProvider>
      <BodyDataProvider>
        <BackupDataProvider>{children}</BackupDataProvider>
      </BodyDataProvider>
    </ProfileDataProvider>
  );
}

function BackupDataProvider({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  return (
    <BackupRepositoryProvider repository={backupRepository()}>
      {children}
    </BackupRepositoryProvider>
  );
}

export function ProfileDataProvider({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  return (
    <ProfileRepositoryProvider repository={profileRepository()}>
      {children}
    </ProfileRepositoryProvider>
  );
}

/**
 * `routines` e `sessions`, os dois decorados com o outbox de sync — mesmo
 * motivo do `dietRepository` acima. `sessions` tem uma regra a mais
 * (`SyncingSessionRepository`): só marca pendente uma sessão já finalizada,
 * então o backfill abaixo também filtra por `finishedAt !== null` — uma
 * sessão em andamento salva antes deste dispositivo abrir o app não deve
 * virar pendente só porque nunca tinha entrada no tracker.
 */
const workoutRepositories = once<WorkoutRepositories>(async () => {
  const { routines, sessions } = await getRepositories();
  const db = await openDatabase(await currentDatabaseName(), MIGRATIONS);
  const tracker = new IndexedDbStore<SyncTracker>(db, SYNC_TRACKER_STORE.name);

  const existingRoutines = await routines.listAll();
  await backfillUntracked(tracker, "routines", existingRoutines.map((routine) => routine.id));
  const pushRoutinesSoon = debouncedTrigger(() => {
    pushAllRoutines(getSupabaseBrowserClient(), tracker, routines).catch(() => {
      // Silencioso de propósito — ver `foodLogRepository` acima.
    });
  }, PUSH_DEBOUNCE_MS);

  const existingSessions = await sessions.listAll();
  await backfillUntracked(
    tracker,
    "sessions",
    existingSessions.filter((session) => session.finishedAt !== null).map((session) => session.id),
  );
  const pushSessionsSoon = debouncedTrigger(() => {
    pushAllSessions(getSupabaseBrowserClient(), tracker, sessions).catch(() => {
      // Silencioso de propósito — ver `foodLogRepository` acima.
    });
  }, PUSH_DEBOUNCE_MS);

  return {
    routines: new SyncingRoutineRepository(routines, tracker, pushRoutinesSoon),
    sessions: new SyncingSessionRepository(sessions, tracker, pushSessionsSoon),
  };
});

export function ExerciseDataProvider({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  return (
    <ExerciseRepositoryProvider repository={exerciseRepository()}>
      {children}
    </ExerciseRepositoryProvider>
  );
}

/**
 * The routine builder picks exercises, so it needs the catalogue as well as
 * routines and sessions. Composed here so a route never has to know which
 * repositories a screen's components happen to reach for.
 */
export function WorkoutDataProvider({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  return (
    <WorkoutRepositoryProvider repositories={workoutRepositories()}>
      <ExerciseDataProvider>{children}</ExerciseDataProvider>
    </WorkoutRepositoryProvider>
  );
}

export function FoodDataProvider({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  return (
    <FoodRepositoryProvider repository={foodRepository()}>
      {children}
    </FoodRepositoryProvider>
  );
}

export function DietDataProvider({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  return (
    <DietRepositoryProvider repository={dietRepository()}>
      {children}
    </DietRepositoryProvider>
  );
}

/**
 * Adherence reads every diet and every food log in the window — nothing
 * else. Narrower than `FoodLogDataProvider` on purpose: this section adds
 * no food and compares against no profile target, it only counts.
 */
export function DietAdherenceDataProvider({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  return (
    <DietRepositoryProvider repository={dietRepository()}>
      <FoodLogRepositoryProvider repository={foodLogRepository()}>
        {children}
      </FoodLogRepositoryProvider>
    </DietRepositoryProvider>
  );
}

/**
 * The home screen reads across the app and writes nothing.
 *
 * Deliberately narrower than the screens it summarises: it needs today's food
 * log, the profile behind the targets, the sessions, and the body log behind
 * the weight — but not the foods (it adds nothing to a meal), not the diets
 * (it starts no day from one) and not the exercise catalogue (it names
 * sessions, never their exercises). Wiring those in anyway would cost three
 * IndexedDB opens on the first screen of the app for data nothing on it reads.
 *
 * The body log joined the list when the screen grew a weight card. It was
 * excluded here on the grounds that nothing read it, and that stopped being
 * true — which is the whole point of stating the reason rather than the rule.
 */
export function HomeDataProvider({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  return (
    <FoodLogRepositoryProvider repository={foodLogRepository()}>
      <ProfileRepositoryProvider repository={profileRepository()}>
        <WorkoutRepositoryProvider repositories={workoutRepositories()}>
          <BodyRepositoryProvider repository={bodyRepository()}>
            {children}
          </BodyRepositoryProvider>
        </WorkoutRepositoryProvider>
      </ProfileRepositoryProvider>
    </FoodLogRepositoryProvider>
  );
}

/**
 * The diet editor picks foods and, when a profile exists, compares its totals
 * against that profile's targets. Composed here rather than nested at the
 * page, so a route never has to know which repositories a screen's components
 * happen to reach for.
 */
export function DietEditorDataProvider({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  return (
    <DietDataProvider>
      <FoodDataProvider>
        <ProfileDataProvider>{children}</ProfileDataProvider>
      </FoodDataProvider>
    </DietDataProvider>
  );
}
