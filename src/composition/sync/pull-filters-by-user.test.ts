import { describe, expect, it } from "vitest";

import { pullAllBodyEntries } from "./body-entry-sync";
import { pullAllDiets } from "./diet-sync";
import { pullFoodLog } from "./food-log-sync";
import { pullProfile } from "./profile-sync";
import { pullAllRestDays } from "./rest-day-sync";
import { pullAllRoutines } from "./routine-sync";
import { pullAllSessions } from "./session-sync";
import type { SyncQueryBuilder, SyncSupabaseClient } from "./sync-supabase-client";
import { pullAllWaterEntries } from "./water-entry-sync";

/**
 * Toda leitura da sincronização filtra explicitamente por `user_id` da conta
 * logada, e este teste fica vermelho no dia em que uma deixar de filtrar.
 *
 * Por que importa (Life Pro, `docs/visao-adm-plano.md`): as regras de leitura
 * do banco se somam com OU. Se um dia uma regra deixar uma nutricionista ler
 * linhas de um paciente, uma leitura que dependesse só da regra traria essas
 * linhas para o aparelho dela, misturadas com as dela, e a próxima
 * sincronização as gravaria de volta como se fossem dela. O filtro explícito
 * é o que impede isso, e o fake de `sync-query-builder.test-helper.ts`
 * ignora `.eq()` de propósito, então nenhum outro teste veria o filtro sumir.
 */
const UID = "00000000-0000-4000-8000-0000000000aa";

function recordingClient(): { client: SyncSupabaseClient; filters: Map<string, Record<string, string>> } {
  const filters = new Map<string, Record<string, string>>();
  const client: SyncSupabaseClient = {
    auth: { getUser: () => Promise.resolve({ data: { user: { id: UID } } }) },
    rpc: () => Promise.resolve({ data: [], error: null }),
    from: (table) => ({
      select: () => {
        const eqs: Record<string, string> = {};
        filters.set(table, eqs);
        const builder: SyncQueryBuilder = {
          eq: (column, value) => {
            eqs[column] = value;
            return builder;
          },
          then: (onfulfilled, onrejected) =>
            Promise.resolve({ data: [], error: null }).then(onfulfilled, onrejected),
        };
        return builder;
      },
    }),
  };
  return { client, filters };
}

/** Nada local: com o servidor vazio, a leitura não precisa de nada além disto. */
const empty = new Proxy(
  {},
  {
    get: (_target, name) => () =>
      Promise.resolve(typeof name === "string" && /^(list|getAll|all)/.test(name) ? [] : null),
  },
) as never;

const PULLS: readonly [table: string, run: (client: SyncSupabaseClient) => Promise<unknown>][] = [
  ["body_entries", (client) => pullAllBodyEntries(client, empty, empty)],
  ["diets", (client) => pullAllDiets(client, empty, empty)],
  ["food_logs", (client) => pullFoodLog(client, empty, empty, "2026-10-01")],
  ["profiles", (client) => pullProfile(client, empty, empty)],
  ["rest_days", (client) => pullAllRestDays(client, empty, empty)],
  ["routines", (client) => pullAllRoutines(client, empty, empty)],
  ["workout_sessions", (client) => pullAllSessions(client, empty, empty)],
  ["water_entries", (client) => pullAllWaterEntries(client, empty, empty)],
];

describe("toda leitura da sincronização filtra pela conta logada", () => {
  for (const [table, run] of PULLS) {
    it(table, async () => {
      const { client, filters } = recordingClient();
      await run(client);
      expect(filters.has(table), `a leitura não consultou ${table}`).toBe(true);
      expect(filters.get(table)?.user_id, `${table} sem .eq("user_id", ...)`).toBe(UID);
    });
  }
});
