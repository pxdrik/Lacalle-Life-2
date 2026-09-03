import { deepEqual } from "@/core/domain/deep-equal";
import type { Meal } from "@/features/diet/types/diet";

/**
 * A representação de fio de uma refeição — a única que carrega tombstone.
 * O `Meal` de domínio (o que a UI/o editor de dieta leem e escrevem) nunca
 * tem `deletedAt`; apagar uma refeição no app continua sendo uma remoção
 * normal do array local. Ver docs/arquitetura-sincronizacao.md §19.5.
 */
export interface WireMeal extends Meal {
  readonly deletedAt: string | null;
}

export interface MealConflict {
  readonly mealId: string;
  readonly local: WireMeal;
  readonly remote: WireMeal;
}

export interface FoodLogMergeResult {
  /** Refeições vivas, ordenadas por horário e depois por id — prontas para a UI e para gravação local. */
  readonly liveMeals: readonly Meal[];
  /** O payload de fio completo (vivas + tombstones) — o que vai para `save_food_log` e vira o próximo snapshot conhecido. */
  readonly wireMeals: readonly WireMeal[];
  /** Refeições com o mesmo id, conteúdo diferente nos dois lados, sem uma exclusão que explique a diferença — pedem resolução explícita. */
  readonly conflicts: readonly MealConflict[];
}

/**
 * Une o conjunto de refeições local (dispositivo que está sincronizando)
 * com o do servidor, por `Meal.id` — a mecânica fechada em §19.5.
 *
 * `lastSynced` é o último payload de fio que este dispositivo sabe ter
 * sincronizado com sucesso (`null` na primeira sincronização) — é o que
 * permite distinguir "o outro lado adicionou algo que eu não tenho" de "eu
 * apaguei algo que o outro lado ainda tem": um id vivo em `lastSynced` que
 * sumiu de `local` foi apagado agora, não é ausência por nunca ter existido
 * aqui.
 *
 * Regras, nesta ordem, para cada `Meal.id` presente em algum dos lados:
 * 1. Só de um lado (vivo ou tombstone) → entra sem questionar.
 * 2. Dos dois lados, conteúdo idêntico (mesmo estado de tombstone incluído)
 *    → não há nada a decidir.
 * 3. Dos dois lados, os dois apagados → apagado vence; desempate
 *    determinístico por `deletedAt` mais recente, para os dois dispositivos
 *    convergirem no mesmo payload byte a byte.
 * 4. Dos dois lados, um apagado e o outro vivo → se o lado vivo não mudou
 *    nada desde `lastSynced` (só não apagou), a exclusão vence sem
 *    conflito. Se o lado vivo tem uma edição real, é conflito — nunca
 *    aplica a exclusão nem a edição sozinha.
 * 5. Dos dois lados vivos, conteúdo diferente → conflito, o caso já
 *    documentado desde a primeira versão de §19.5.
 */
export function mergeFoodLogMeals(
  local: readonly Meal[],
  remote: readonly WireMeal[],
  lastSynced: readonly WireMeal[] | null,
): FoodLogMergeResult {
  const base = lastSynced ?? [];
  const baseById = new Map(base.map((meal) => [meal.id, meal]));
  const liveLocalIds = new Set(local.map((meal) => meal.id));
  const now = new Date().toISOString();

  const localWire = new Map<string, WireMeal>();
  for (const meal of local) localWire.set(meal.id, { ...meal, deletedAt: null });

  for (const baseMeal of base) {
    if (localWire.has(baseMeal.id)) continue;
    if (baseMeal.deletedAt === null && !liveLocalIds.has(baseMeal.id)) {
      // Vivo na última sincronização, ausente do local agora: apagado.
      localWire.set(baseMeal.id, { ...baseMeal, deletedAt: now });
    } else if (baseMeal.deletedAt !== null) {
      // Tombstone que este dispositivo já conhecia — continua carregando,
      // mesmo que este pull/push não tenha vindo de um pull remoto recente.
      localWire.set(baseMeal.id, baseMeal);
    }
  }

  const remoteWire = new Map(remote.map((meal) => [meal.id, meal]));
  const allIds = new Set([...localWire.keys(), ...remoteWire.keys()]);

  const merged = new Map<string, WireMeal>();
  const conflicts: MealConflict[] = [];

  for (const id of allIds) {
    const l = localWire.get(id);
    const r = remoteWire.get(id);

    if (l !== undefined && r === undefined) {
      merged.set(id, l);
      continue;
    }
    if (r !== undefined && l === undefined) {
      merged.set(id, r);
      continue;
    }
    if (l === undefined || r === undefined) continue; // inalcançável, satisfaz o TS

    if (deepEqual(l, r)) {
      merged.set(id, l);
      continue;
    }

    const localTombstoned = l.deletedAt !== null;
    const remoteTombstoned = r.deletedAt !== null;

    if (localTombstoned && remoteTombstoned) {
      merged.set(id, (l.deletedAt as string) >= (r.deletedAt as string) ? l : r);
      continue;
    }

    if (localTombstoned !== remoteTombstoned) {
      const liveEntry = localTombstoned ? r : l;
      const tombstoneEntry = localTombstoned ? l : r;
      const baseEntry = baseById.get(id);
      const liveChangedSinceBase =
        baseEntry === undefined || !liveContentEqual(liveEntry, baseEntry);

      if (liveChangedSinceBase) {
        conflicts.push({ mealId: id, local: l, remote: r });
        merged.set(id, l);
      } else {
        merged.set(id, tombstoneEntry);
      }
      continue;
    }

    conflicts.push({ mealId: id, local: l, remote: r });
    merged.set(id, l);
  }

  const wireMeals = [...merged.values()];
  const liveMeals = wireMeals
    .filter((meal) => meal.deletedAt === null)
    .map(stripDeletedAt)
    .sort(byTimeThenId);

  return { liveMeals, wireMeals, conflicts };
}

/** Compara dois payloads de fio ignorando ordem — usado pelo motor de sync para decidir se ainda há algo a enviar depois de um merge limpo. */
export function wireMealsEqual(
  a: readonly WireMeal[],
  b: readonly WireMeal[],
): boolean {
  if (a.length !== b.length) return false;
  const byId = new Map(b.map((meal) => [meal.id, meal]));
  return a.every((meal) => {
    const other = byId.get(meal.id);
    return other !== undefined && deepEqual(meal, other);
  });
}

function stripDeletedAt(meal: WireMeal): Meal {
  const { deletedAt: _deletedAt, ...rest } = meal;
  return rest;
}

/** Compara conteúdo ignorando `deletedAt` — "esse lado mudou de verdade, ou só não apagou?" */
function liveContentEqual(a: WireMeal, b: WireMeal): boolean {
  const { deletedAt: _a, ...restA } = a;
  const { deletedAt: _b, ...restB } = b;
  return deepEqual(restA, restB);
}

/** Sem horário vai para o final; empate (inclusive as duas sem horário) desempata por id lexicográfico — §19.5, decisão fechada em 24/08/2026. */
function byTimeThenId(a: Meal, b: Meal): number {
  if (a.time !== b.time) {
    if (a.time === null) return 1;
    if (b.time === null) return -1;
    return a.time.localeCompare(b.time);
  }
  return a.id.localeCompare(b.id);
}
