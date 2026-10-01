import { cleanup, render, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { describe, expect, it, vi } from "vitest";

import { useDietRepository } from "@/features/diet/data/diet-repository-context";
import type { PlanRepository } from "@/features/pro/data/plan-repository";
import { PlanRepositoryProvider, usePlanRepository } from "@/features/pro/data/plan-repository-context";

import { PlanEditorDataProvider } from "./plan-editor-data-provider";

/**
 * Publicar lê o rascunho que está no banco. Se a última edição ainda estiver
 * a caminho, a versão publicada sai sem ela, e o paciente recebe um plano que
 * a profissional não viu. Aqui a rede segura cada gravação até o teste soltar.
 */
const events: string[] = [];
const release: (() => void)[] = [];

vi.mock("@/core/auth/supabase-browser-client", () => ({
  getSupabaseBrowserClient: () => ({
    auth: { getUser: () => Promise.resolve({ data: { user: { id: "u" } } }) },
    rpc: (_fn: string, args?: Record<string, unknown>) =>
      new Promise((resolve) => {
        release.push(() => {
          events.push(`gravou ${String(args?.["p_name"])}`);
          resolve({ data: null, error: null });
        });
      }),
    from: () => {
      throw new Error("não usado");
    },
  }),
}));

function EditThenPublish() {
  const diets = useDietRepository();
  const plans = usePlanRepository();
  useEffect(() => {
    void (async () => {
      const repo = await diets;
      void repo.save({ id: "p", name: "Última edição", meals: [], weekdays: [], createdAt: 1, updatedAt: 2 }, 1);
      await plans.publish("p", "");
    })();
  }, [diets, plans]);
  return null;
}

describe("publicar o plano pelo editor", () => {
  it("espera a última edição chegar ao banco antes de publicar", async () => {
    const base: PlanRepository = {
      listPlans: () => Promise.resolve([]),
      createPlan: () => Promise.resolve("p"),
      publish: () => {
        events.push("publicou");
        return Promise.resolve(1);
      },
    };
    render(
      <PlanRepositoryProvider repository={base}>
        <PlanEditorDataProvider planId="p" linkId="l">
          <EditThenPublish />
        </PlanEditorDataProvider>
      </PlanRepositoryProvider>,
    );

    await waitFor(() => {
      expect(release.length).toBe(1);
    });
    // A gravação ainda está no ar: publicar não pode ter saído.
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(events).toEqual([]);

    release.shift()!();
    await waitFor(() => {
      expect(events).toEqual(["gravou Última edição", "publicou"]);
    });
  });

  it("a volta do seletor de alimentos abre a edição que ainda está a caminho do banco", async () => {
    const plans: PlanRepository = {
      listPlans: () => Promise.resolve([]),
      createPlan: () => Promise.resolve("q"),
      publish: () => Promise.resolve(1),
    };
    let opened: string | undefined;
    function Edit() {
      const diets = useDietRepository();
      useEffect(() => {
        void diets.then((repo) =>
          repo.save({ id: "q", name: "Antes de sair", meals: [], weekdays: [], createdAt: 1, updatedAt: 2 }, 1),
        );
      }, [diets]);
      return null;
    }
    function Open() {
      const diets = useDietRepository();
      useEffect(() => {
        void diets.then((repo) => repo.getById("q")).then((diet) => {
          opened = diet?.name;
        });
      }, [diets]);
      return null;
    }
    const tree = (child: React.ReactNode) => (
      <PlanRepositoryProvider repository={plans}>
        <PlanEditorDataProvider planId="q" linkId="l">
          {child}
        </PlanEditorDataProvider>
      </PlanRepositoryProvider>
    );

    render(tree(<Edit />));
    await waitFor(() => {
      expect(release.length).toBe(1);
    });
    // Sai para o seletor (a tela desmonta) e volta antes de a gravação chegar.
    cleanup();
    render(tree(<Open />));
    await waitFor(() => {
      expect(opened).toBe("Antes de sair");
    });
    release.shift()!();
  });
});
