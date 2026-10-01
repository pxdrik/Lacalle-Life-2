import { z } from "zod";

import { WEEKDAYS } from "@/features/diet/services/diet-schedule";
import type { Weekday } from "@/features/diet/types/diet";
import type { ProSupabaseClient } from "@/features/pro/data/supabase-pro-repository";
import type { RoutineRepository } from "@/features/workouts/data/routine-repository";
import type { Routine } from "@/features/workouts/types/routine";

import { routinePayloadSchema } from "./backup-schemas";

/**
 * O editor de treino do app editando o treino que o treinador monta no Life
 * Pro (Etapa 8c): este repositório se apresenta como `RoutineRepository`, mas
 * por trás lê e grava o RASCUNHO do treino no Supabase (migração 0038). O
 * mesmo desenho de `plan-draft-repository.ts`, e pelos mesmos motivos:
 *
 * - **Gravações em fila.** O editor grava a cada mudança; pela rede, uma
 *   gravação antiga poderia chegar depois de uma nova e desfazê-la. Só uma
 *   vai por vez, e a próxima leva sempre a versão mais nova.
 * - **Sem conflito por versão.** O rascunho é de uma pessoa só, e o banco
 *   já recusa quem não tem vínculo ativo.
 * - Abrir sem rascunho começa da última versão publicada.
 *
 * Os dias do treino não fazem parte de `Routine` (as rotinas do paciente não
 * têm dias). Moram aqui, ao lado da rotina, e vão na MESMA fila: um gravador
 * só para o rascunho, e trocar os dias nunca desfaz uma edição do editor, nem
 * o contrário.
 */
const payload = routinePayloadSchema;
const weekdays = z.array(z.enum(WEEKDAYS as [Weekday, ...Weekday[]]));
const content = z.object({ name: z.string(), notes: z.string(), exercises: z.unknown(), weekdays });

export type RoutineDraftRepository = RoutineRepository & {
  /** Espera a última mudança chegar ao banco: publicar lê o rascunho de lá. */
  readonly flush: () => Promise<void>;
  /** Os dias do treino; vazio é "quando quiser". Lido junto com a rotina. */
  readonly weekdays: () => Promise<readonly Weekday[]>;
  readonly setWeekdays: (days: readonly Weekday[]) => Promise<void>;
};

export function createRoutineDraftRepository(
  client: ProSupabaseClient,
  target: { readonly routineId: string; readonly linkId: string },
): RoutineDraftRepository {
  let loaded: Promise<{ routine: Routine | undefined; days: readonly Weekday[] }> | null = null;
  type Pending = { readonly routine: Routine; readonly days: readonly Weekday[] };
  let latest: Pending | null = null;
  let running: Promise<void> | null = null;

  async function write(next: Pending): Promise<void> {
    const { error } = await client.rpc("save_routine_draft", {
      p_routine_id: target.routineId,
      p_link_id: target.linkId,
      p_name: next.routine.name.trim() === "" ? "Treino" : next.routine.name,
      p_notes: next.routine.notes,
      p_exercises: next.routine.exercises,
      p_weekdays: WEEKDAYS.filter((day) => next.days.includes(day)),
    });
    if (error !== null) throw new Error(error.message);
  }

  async function read(): Promise<{ routine: Routine | undefined; days: readonly Weekday[] }> {
    const draft = await client
      .from("prescribed_routine_drafts")
      .select("name,notes,exercises,weekdays,updated_at")
      .eq("routine_id", target.routineId);
    if (draft.error !== null) throw new Error(draft.error.message);
    const [row] = z.array(content.extend({ updated_at: z.string() })).parse(draft.data);
    if (row !== undefined) return { routine: toRoutine(row, Date.parse(row.updated_at)), days: row.weekdays };

    const versions = await client
      .from("prescribed_routine_versions")
      .select("name,notes,exercises,weekdays,version,published_at")
      .eq("routine_id", target.routineId);
    if (versions.error !== null) throw new Error(versions.error.message);
    const published = z
      .array(content.extend({ version: z.number(), published_at: z.string() }))
      .parse(versions.data)
      .sort((a, b) => b.version - a.version)[0];
    if (published === undefined) return { routine: undefined, days: [] };
    return { routine: toRoutine(published, Date.parse(published.published_at)), days: published.weekdays };
  }

  function load() {
    loaded ??= read().catch((cause: unknown) => {
      loaded = null;
      throw cause;
    });
    return loaded;
  }

  function toRoutine(row: z.infer<typeof content>, updatedAt: number): Routine {
    const parsed = payload.parse({ name: row.name === "" ? "Treino" : row.name, notes: row.notes, exercises: row.exercises });
    return {
      id: target.routineId,
      name: parsed.name,
      notes: parsed.notes,
      // O mesmo `?? null` de `routine-sync.ts`: `durationSeconds` é opcional
      // no schema, e `Routine` nunca leva `undefined`.
      exercises: parsed.exercises.map((exercise) => ({
        ...exercise,
        sets: exercise.sets.map((set) => ({ ...set, durationSeconds: set.durationSeconds ?? null })),
      })),
      createdAt: updatedAt,
      updatedAt,
    };
  }

  function enqueue(next: Pending): Promise<void> {
    latest = next;
    if (running === null) {
      running = (async () => {
        let current: Pending | null = latest;
        let sent: Pending | null = null;
        while (current !== null && current !== sent) {
          sent = current;
          await write(current);
          current = latest;
        }
      })().finally(() => {
        running = null;
      });
    }
    return running;
  }

  async function current(): Promise<{ routine: Routine | undefined; days: readonly Weekday[] }> {
    const base = await load();
    return latest ?? base;
  }

  /**
   * Lê o estado e põe na fila no MESMO passo síncrono, sem `await` no meio.
   * Com um `await` entre ler e enfileirar, chamadas seguidas (o editor
   * gravando e os dias mudando no mesmo instante) liam todas o estado de
   * antes, e trocar os dias gravava a rotina como estava ao abrir, por cima
   * das edições (visto vermelho no teste de banco).
   */
  async function update(change: (state: { routine: Routine | undefined; days: readonly Weekday[] }) => Pending | null) {
    const base = await load();
    const next = change(latest ?? base);
    return next === null ? undefined : enqueue(next);
  }

  return {
    async listAll() {
      const { routine } = await current();
      return routine === undefined ? [] : [routine];
    },
    async getById(id) {
      if (id !== target.routineId) return undefined;
      return (await current()).routine;
    },
    save(routine) {
      return update(({ days }) => ({ routine, days }));
    },
    remove() {
      return Promise.reject(new Error("Um treino prescrito não se apaga pelo editor."));
    },
    flush() {
      return running ?? Promise.resolve();
    },
    async weekdays() {
      return (await current()).days;
    },
    setWeekdays(days) {
      return update(({ routine }) => (routine === undefined ? null : { routine, days }));
    },
  };
}
