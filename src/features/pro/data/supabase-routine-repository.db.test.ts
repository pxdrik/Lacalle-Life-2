import { beforeAll, describe, expect, it } from "vitest";

import { createRoutineDraftRepository } from "@/composition/routine-draft-repository";
import { clientAs, createTestDb, type TestDb } from "@/test/supabase-db";

import { NO_DRAFT } from "./plan-repository";
import { createSupabaseCareRepository } from "./supabase-care-repository";
import { createSupabaseProRepository } from "./supabase-pro-repository";
import { createSupabaseRoutineRepository } from "./supabase-routine-repository";

/**
 * O repositório de treinos do treinador contra o banco de verdade (0038):
 * criar, listar e publicar, o caminho da seção "Treino" do paciente no Life
 * Pro. O par de `supabase-plan-repository.db.test.ts`.
 */
describe("SupabaseRoutineRepository contra o banco", () => {
  let t: TestDb;
  let rafael: string;
  let linkId: string;
  const routines = (uid: string | null) => createSupabaseRoutineRepository(clientAs(t, uid));

  async function approved(email: string, name: string): Promise<string> {
    const uid = await t.createUser(email);
    await createSupabaseProRepository(clientAs(t, uid)).requestAccess({
      displayName: name,
      registrations: { crn: null, cref: { number: "012345-G", region: "SP" } },
    });
    return uid;
  }

  beforeAll(async () => {
    t = await createTestDb();
    const admin = await t.createUser("lacallepm@gmail.com");
    await t.db.query("insert into public.app_admins (user_id) values ($1)", [admin]);
    rafael = await approved("rafael@exemplo.com", "Rafael Moura");
    await createSupabaseProRepository(clientAs(t, admin)).approve(rafael);
    const ana = await t.createUser("ana@exemplo.com");
    const { token } = await createSupabaseCareRepository(clientAs(t, rafael)).createInvite("Ana");
    await createSupabaseCareRepository(clientAs(t, ana)).acceptInvite(token, { diary: true, body: true, profile: true });
    [{ id: linkId }] = await createSupabaseCareRepository(clientAs(t, rafael)).listMyPatients().then((r) => r.links);
  });

  it("cria com rascunho, publica a versão 1 com os dias, e o rascunho some", async () => {
    const id = await routines(rafael).createRoutine(linkId, "Treino A");
    expect(await routines(rafael).listRoutines(linkId)).toEqual([{ id, name: "Treino A", hasDraft: true, versions: [] }]);

    await createRoutineDraftRepository(clientAs(t, rafael), { routineId: id, linkId }).setWeekdays(["mon", "thu"]);
    expect(await routines(rafael).publish(id, "Primeiro treino")).toBe(1);
    const [routine] = await routines(rafael).listRoutines(linkId);
    expect(routine).toMatchObject({
      hasDraft: false,
      versions: [{ version: 1, changeNote: "Primeiro treino", weekdays: ["mon", "thu"] }],
    });
  });

  it("publicar sem rascunho é recusado com o motivo que a tela traduz", async () => {
    const [routine] = await routines(rafael).listRoutines(linkId);
    await expect(routines(rafael).publish(routine!.id, "")).rejects.toThrow(NO_DRAFT);
  });

  it("outro treinador não lista os treinos deste vínculo", async () => {
    const outro = await approved("outro@exemplo.com", "Outro");
    expect(await routines(outro).listRoutines(linkId)).toEqual([]);
  });
});
