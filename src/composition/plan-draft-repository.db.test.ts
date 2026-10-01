import { beforeAll, describe, expect, it } from "vitest";

import type { Diet, Meal } from "@/features/diet/types/diet";
import { clientAs, createTestDb, type TestDb } from "@/test/supabase-db";

import { createPlanDraftDietRepository } from "./plan-draft-repository";

/**
 * O editor de dieta gravando o rascunho do plano (0035), contra o banco de
 * verdade: o que a nutricionista edita vai para o rascunho, o paciente não o
 * vê, e várias gravações seguidas terminam na mais nova.
 */
const meal = (id: string, name: string): Meal => ({ id, name, time: "07:30", notes: "", items: [] });

describe("rascunho do plano pelo editor de dieta", () => {
  let t: TestDb;
  let marina: string;
  let ana: string;
  let linkId: string;
  let planId: string;

  beforeAll(async () => {
    t = await createTestDb();
    const admin = await t.createUser("lacallepm@gmail.com");
    await t.db.query("insert into public.app_admins (user_id) values ($1)", [admin]);
    marina = await t.createUser("marina@exemplo.com");
    await t.as(marina, (tx) =>
      tx.query("select public.request_professional_access('nutritionist', 'Marina Faria', 'CRN-3', '1')"),
    );
    await t.as(admin, (tx) => tx.query("select public.admin_review_professional($1, 'approve', null)", [marina]));
    ana = await t.createUser("ana@exemplo.com");
    const invite = await t.as(marina, (tx) => tx.query<{ token: string }>("select token from public.create_invite('Ana')"));
    const accepted = await t.as(ana, (tx) =>
      tx.query<{ accept_invite: string }>("select public.accept_invite($1, true, true, true)", [invite.rows[0]!.token]),
    );
    linkId = accepted.rows[0]!.accept_invite;
    const created = await t.as(marina, (tx) =>
      tx.query<{ save_plan_draft: string }>("select public.save_plan_draft(null, $1, 'Recomposição', '[]')", [linkId]),
    );
    planId = created.rows[0]!.save_plan_draft;
  });

  it("abre o rascunho, grava em fila e termina na versão mais nova", async () => {
    const repo = createPlanDraftDietRepository(clientAs(t, marina), { planId, linkId });
    const opened = (await repo.getById(planId))!;
    expect(opened).toMatchObject({ id: planId, name: "Recomposição", meals: [] });

    const edits: Diet[] = ["Café", "Café da manhã", "Café da manhã leve"].map((name, index) => ({
      ...opened,
      meals: [meal("m1", name)],
      updatedAt: opened.updatedAt + index + 1,
    }));
    await Promise.all(edits.map((diet) => repo.save(diet, null)));

    const fresh = createPlanDraftDietRepository(clientAs(t, marina), { planId, linkId });
    expect((await fresh.getById(planId))!.meals.map((m) => m.name)).toEqual(["Café da manhã leve"]);
  });

  it("o paciente não lê o rascunho, nem por este repositório", async () => {
    const repo = createPlanDraftDietRepository(clientAs(t, ana), { planId, linkId });
    expect(await repo.getById(planId)).toBeUndefined();
  });

  it("sem rascunho, abre da última versão publicada", async () => {
    await t.as(marina, (tx) => tx.query("select public.publish_plan($1, '')", [planId]));
    const repo = createPlanDraftDietRepository(clientAs(t, marina), { planId, linkId });
    expect((await repo.getById(planId))!.meals.map((m) => m.name)).toEqual(["Café da manhã leve"]);
  });
});
