import { beforeAll, describe, expect, it } from "vitest";

import { clientAs, createTestDb, type TestDb } from "@/test/supabase-db";

import { createSupabaseCareRepository } from "./supabase-care-repository";
import { createSupabaseProRepository } from "./supabase-pro-repository";

/**
 * O repositório de vínculos e convites contra o banco de verdade (0034): o
 * caminho que a nutricionista e o paciente vão fazer pelas telas.
 */
describe("SupabaseCareRepository contra o banco", () => {
  let t: TestDb;
  let admin: string;
  let marina: string;
  const care = (uid: string | null) => createSupabaseCareRepository(clientAs(t, uid));

  beforeAll(async () => {
    t = await createTestDb();
    admin = await t.createUser("lacallepm@gmail.com");
    await t.db.query("insert into public.app_admins (user_id) values ($1)", [admin]);
    marina = await t.createUser("marina@exemplo.com");
    await createSupabaseProRepository(clientAs(t, marina)).requestAccess({
      displayName: "Marina Faria",
      registrations: { crn: { region: "CRN-3", number: "12345" }, cref: null },
    });
    await createSupabaseProRepository(clientAs(t, admin)).approve(marina);
  });

  it("convite, página do convite, aceite, lista dos dois lados, mudança e encerramento", async () => {
    const { token } = await care(marina).createInvite("Ana Luísa Prado");
    expect(await care(null).getInvite(token)).toEqual({
      state: "valid",
      professionalName: "Marina Faria",
      council: "CRN-3 12345",
      isOwn: false,
    });
    expect((await care(marina).getInvite(token)).isOwn).toBe(true);

    const pending = await care(marina).listMyPatients();
    expect(pending.invites.map((invite) => invite.label)).toContain("Ana Luísa Prado");

    const ana = await t.createUser("ana@exemplo.com");
    await care(ana).acceptInvite(token, { diary: true, body: false, profile: true });

    const [mine] = await care(ana).listMyLinks();
    expect(mine).toMatchObject({
      professionalName: "Marina Faria",
      status: "active",
      sharing: { diary: true, body: false, profile: true },
    });

    const patients = await care(marina).listMyPatients();
    expect(patients.links).toEqual([expect.objectContaining({ label: "Ana Luísa Prado", status: "active" })]);
    expect(patients.invites.map((invite) => invite.label)).not.toContain("Ana Luísa Prado");

    await care(ana).updateSharing(mine!.linkId, { diary: true, body: true, profile: false });
    expect((await care(marina).listMyPatients()).links[0]!.sharing).toEqual({ diary: true, body: true, profile: false });

    const adminView = await care(admin).listLinksOf(marina);
    expect(adminView).toHaveLength(1);
    expect(Object.keys(adminView[0]!).sort()).toEqual(["createdAt", "endedAt", "id", "label", "sharing", "status"]);

    await care(ana).endLink(mine!.linkId);
    expect((await care(ana).listMyLinks())[0]!.status).toBe("ended");
    expect(await care(null).getInvite(token)).toMatchObject({ state: "used" });
  });

  it("cancelar tira o convite da lista e invalida o código", async () => {
    const { token } = await care(marina).createInvite("Para cancelar");
    const { invites } = await care(marina).listMyPatients();
    const invite = invites.find((item) => item.label === "Para cancelar")!;
    await care(marina).cancelInvite(invite.id);
    expect((await care(marina).listMyPatients()).invites.map((item) => item.label)).not.toContain("Para cancelar");
    expect((await care(null).getInvite(token)).state).toBe("invalid");
  });

  it("quem não é profissional aprovado recebe erro ao convidar", async () => {
    const someone = await t.createUser("comum@exemplo.com");
    await expect(care(someone).createInvite("X")).rejects.toThrow(/not an approved professional/);
  });

  it("o paciente não vê os vínculos que não são dele", async () => {
    const outsider = await t.createUser("fora@exemplo.com");
    expect(await care(outsider).listMyLinks()).toEqual([]);
    expect(await care(outsider).listLinksOf(marina)).toEqual([]);
  });
});
