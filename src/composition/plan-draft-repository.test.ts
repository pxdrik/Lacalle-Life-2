import { describe, expect, it } from "vitest";

import type { Diet } from "@/features/diet/types/diet";
import type { ProSupabaseClient } from "@/features/pro/data/supabase-pro-repository";

import { createPlanDraftDietRepository } from "./plan-draft-repository";

/**
 * A fila de gravações do rascunho, com uma rede que demora: o teste contra o
 * banco não enxerga isso (o Postgres de teste executa tudo em ordem). Aqui
 * cada gravação só termina quando o teste manda, para provar que nunca há
 * duas no ar e que a última gravada é a mais nova.
 */
function slowClient() {
  const written: string[] = [];
  const pending: (() => void)[] = [];
  let inFlight = 0;
  let maxInFlight = 0;
  const client = {
    auth: { getUser: () => Promise.resolve({ data: { user: { id: "u" } } }) },
    rpc: (_fn: string, args?: Record<string, unknown>) => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      return new Promise<{ data: unknown; error: null }>((resolve) => {
        pending.push(() => {
          inFlight -= 1;
          written.push(String(args?.["p_name"]));
          resolve({ data: null, error: null });
        });
      });
    },
    from: () => {
      throw new Error("não usado");
    },
  } as unknown as ProSupabaseClient;
  return { client, written, pending, maxInFlight: () => maxInFlight };
}

const diet = (name: string): Diet => ({ id: "p", name, meals: [], weekdays: [], createdAt: 1, updatedAt: 1 });

describe("fila de gravações do rascunho", () => {
  it("uma gravação por vez, e a última gravada é a mais nova", async () => {
    const net = slowClient();
    const repo = createPlanDraftDietRepository(net.client, { planId: "p", linkId: "l" });

    const all = ["A", "B", "C", "D"].map((name) => repo.save(diet(name), null));
    // Termina cada gravação na hora em que ela aparece.
    while (net.pending.length > 0 || net.written.length === 0) {
      await Promise.resolve();
      net.pending.shift()?.();
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    await Promise.all(all);

    expect(net.maxInFlight(), "duas gravações no ar ao mesmo tempo").toBe(1);
    expect(net.written.at(-1)).toBe("D");
    expect(net.written.length, "gravou estados intermediários que já tinham sido superados").toBeLessThanOrEqual(2);
  });
});
