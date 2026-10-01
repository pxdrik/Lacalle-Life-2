import { beforeAll, describe, expect, it } from "vitest";

import { MemoryStore } from "@/core/storage/memory-store";
import {
  LocalPrescribedPlanRepository,
  PRESCRIBED_PLANS_STORE,
} from "@/features/diet/data/prescribed-plan-repository";
import type { Meal } from "@/features/diet/types/diet";
import type { PrescribedPlan } from "@/features/diet/types/prescribed-plan";
import { createSupabaseCareRepository } from "@/features/pro/data/supabase-care-repository";
import { createSupabasePlanRepository } from "@/features/pro/data/supabase-plan-repository";
import { createSupabaseProRepository } from "@/features/pro/data/supabase-pro-repository";
import { clientAs, createTestDb, type TestDb } from "@/test/supabase-db";

import { pullPrescribedPlans } from "./prescribed-plan-sync";
import type { SyncSupabaseClient } from "./sync-supabase-client";

/**
 * O plano descendo para o aparelho do paciente, contra o banco de verdade
 * (0035). O que importa é quem recebe o quê: o rascunho nunca desce, outro
 * paciente não recebe, e a nutricionista que também usa o app para a própria
 * dieta não puxa os planos que ela montou (o banco deixa ela lê-los; quem
 * impede é o filtro por `patient_id`).
 */
const meal = (name: string): Meal => ({ id: `m-${name}`, name, time: "12:30", notes: "Comece pela salada.", items: [] });

describe("planos recebidos pela sincronização", () => {
  let t: TestDb;
  let marina: string;
  let ana: string;
  let planId: string;

  const local = () => new LocalPrescribedPlanRepository(new MemoryStore<PrescribedPlan>(PRESCRIBED_PLANS_STORE));
  const sync = (uid: string) => clientAs(t, uid) as unknown as SyncSupabaseClient;
  beforeAll(async () => {
    t = await createTestDb();
    const admin = await t.createUser("lacallepm@gmail.com");
    await t.db.query("insert into public.app_admins (user_id) values ($1)", [admin]);
    marina = await t.createUser("marina@exemplo.com");
    await createSupabaseProRepository(clientAs(t, marina)).requestAccess({
      displayName: "Marina Faria",
      councilRegion: "CRN-3",
      councilNumber: "1",
    });
    await createSupabaseProRepository(clientAs(t, admin)).approve(marina);
    ana = await t.createUser("ana@exemplo.com");
    const { token } = await createSupabaseCareRepository(clientAs(t, marina)).createInvite("Ana");
    await createSupabaseCareRepository(clientAs(t, ana)).acceptInvite(token, { diary: true, body: true, profile: true });
    const [link] = (await createSupabaseCareRepository(clientAs(t, marina)).listMyPatients()).links;
    planId = await createSupabasePlanRepository(clientAs(t, marina)).createPlan(link!.id, "Recomposição");
  });

  async function saveDraft(meals: Meal[]) {
    const [link] = (await createSupabaseCareRepository(clientAs(t, marina)).listMyPatients()).links;
    await t.as(marina, (tx) =>
      tx.query("select public.save_plan_draft($1, $2, 'Recomposição', $3::jsonb)", [planId, link!.id, JSON.stringify(meals)]),
    );
  }

  it("o rascunho não desce: sem versão publicada, o paciente não recebe nada", async () => {
    const repo = local();
    expect(await pullPrescribedPlans(sync(ana), repo)).toEqual({ status: "done" });
    expect(await repo.listAll()).toEqual([]);
  });

  it("a versão publicada desce com a anterior, o nome da profissional e o que o paciente já viu", async () => {
    await saveDraft([meal("Almoço")]);
    await createSupabasePlanRepository(clientAs(t, marina)).publish(planId, "Primeiro plano");
    const repo = local();
    await pullPrescribedPlans(sync(ana), repo);
    await repo.markSeen(planId, 1);

    await saveDraft([meal("Almoço"), meal("Jantar")]);
    await createSupabasePlanRepository(clientAs(t, marina)).publish(planId, "Jantar novo");
    await pullPrescribedPlans(sync(ana), repo);

    const [plan] = await repo.listAll();
    expect(plan).toMatchObject({
      id: planId,
      professionalName: "Marina Faria",
      version: 2,
      changeNote: "Jantar novo",
      linkEnded: false,
      seenVersion: 1,
      // A primeira publicação dá todos os dias ao plano; o paciente muda.
      weekdays: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"],
      previous: { version: 1 },
    });
    expect(plan!.meals.map((item) => item.name)).toEqual(["Almoço", "Jantar"]);
    expect(plan!.previous!.meals.map((item) => item.name)).toEqual(["Almoço"]);
  });

  it("outro paciente não recebe, e a profissional não puxa o plano que montou", async () => {
    const outro = await t.createUser("outro@exemplo.com");
    for (const uid of [outro, marina]) {
      const repo = local();
      await pullPrescribedPlans(sync(uid), repo);
      expect(await repo.listAll(), uid === marina ? "a profissional puxou o plano da paciente" : "outro paciente recebeu").toEqual([]);
    }
  });

  it("os dias do plano são do paciente: ele muda, e ninguém mais muda", async () => {
    await t.as(ana, (tx) => tx.query("select public.set_plan_schedule($1, array['mon','wed']::text[])", [planId]));
    const repo = local();
    await pullPrescribedPlans(sync(ana), repo);
    expect((await repo.getById(planId))!.weekdays).toEqual(["mon", "wed"]);

    await expect(
      t.as(marina, (tx) => tx.query("select public.set_plan_schedule($1, array['sun']::text[])", [planId])),
      "a profissional mudou os dias do paciente",
    ).rejects.toThrow();
  });
});
