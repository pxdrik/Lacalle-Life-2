import { beforeAll, describe, expect, it } from "vitest";

import { clientAs, createTestDb, type TestDb } from "@/test/supabase-db";

import { NO_DRAFT } from "./plan-repository";
import { createSupabaseCareRepository } from "./supabase-care-repository";
import { createSupabasePlanRepository } from "./supabase-plan-repository";
import { createSupabaseProRepository } from "./supabase-pro-repository";

/**
 * O repositório de planos da profissional contra o banco de verdade (0035):
 * criar, listar e publicar, o caminho da tela do paciente no Life Pro.
 */
describe("SupabasePlanRepository contra o banco", () => {
  let t: TestDb;
  let marina: string;
  let linkId: string;
  const plans = (uid: string | null) => createSupabasePlanRepository(clientAs(t, uid));

  async function approved(email: string, name: string): Promise<string> {
    const uid = await t.createUser(email);
    await createSupabaseProRepository(clientAs(t, uid)).requestAccess({
      displayName: name,
      councilRegion: "CRN-3",
      councilNumber: "1",
    });
    return uid;
  }

  beforeAll(async () => {
    t = await createTestDb();
    const admin = await t.createUser("lacallepm@gmail.com");
    await t.db.query("insert into public.app_admins (user_id) values ($1)", [admin]);
    marina = await approved("marina@exemplo.com", "Marina Faria");
    await createSupabaseProRepository(clientAs(t, admin)).approve(marina);
    const ana = await t.createUser("ana@exemplo.com");
    const { token } = await createSupabaseCareRepository(clientAs(t, marina)).createInvite("Ana");
    await createSupabaseCareRepository(clientAs(t, ana)).acceptInvite(token, { diary: true, body: true, profile: true });
    [{ id: linkId }] = await createSupabaseCareRepository(clientAs(t, marina)).listMyPatients().then((r) => r.links);
  });

  it("cria com rascunho, publica a versão 1 e o rascunho some", async () => {
    const id = await plans(marina).createPlan(linkId, "Recomposição");
    expect(await plans(marina).listPlans(linkId)).toEqual([{ id, name: "Recomposição", hasDraft: true, versions: [] }]);

    expect(await plans(marina).publish(id, "Primeiro plano")).toBe(1);
    const [plan] = await plans(marina).listPlans(linkId);
    expect(plan).toMatchObject({ hasDraft: false, versions: [{ version: 1, changeNote: "Primeiro plano", meals: [] }] });
  });

  it("publicar sem rascunho é recusado com o motivo que a tela traduz", async () => {
    const [plan] = await plans(marina).listPlans(linkId);
    await expect(plans(marina).publish(plan!.id, "")).rejects.toThrow(NO_DRAFT);
  });

  it("outra profissional não lista os planos deste vínculo", async () => {
    const outra = await approved("outra@exemplo.com", "Outra");
    expect(await plans(outra).listPlans(linkId)).toEqual([]);
  });
});
