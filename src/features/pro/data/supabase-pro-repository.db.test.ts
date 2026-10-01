import { beforeAll, describe, expect, it } from "vitest";

import { clientAs, createTestDb, type TestDb } from "@/test/supabase-db";

import { createSupabaseProRepository } from "./supabase-pro-repository";

/**
 * O repositório inteiro contra o banco de verdade (migração 0033): o que a
 * tela de Perfil e a de administração vão chamar, com as regras de acesso
 * aplicadas pelo Postgres, não por um fake.
 */
describe("SupabaseProRepository contra o banco", () => {
  let t: TestDb;
  let admin: string;

  beforeAll(async () => {
    t = await createTestDb();
    admin = await t.createUser("lacallepm@gmail.com");
    await t.db.query("insert into public.app_admins (user_id) values ($1)", [admin]);
  });

  const repo = (uid: string | null) => createSupabaseProRepository(clientAs(t, uid));

  it("sem conta: nada", async () => {
    expect(await repo(null).getMyAccess()).toBeNull();
  });

  it("conta comum sem pedido: nem admin nem profissional", async () => {
    const uid = await t.createUser("comum@exemplo.com");
    expect(await repo(uid).getMyAccess()).toEqual({ isAdmin: false, professional: null });
  });

  it("o caminho todo: pedir, administrador ver, recusar, reenviar, aprovar, suspender", async () => {
    const uid = await t.createUser("beatriz@exemplo.com");
    await repo(uid).requestAccess({ displayName: " Beatriz Nogueira ", councilRegion: "CRN-3", councilNumber: "12345" });
    expect((await repo(uid).getMyAccess())?.professional).toEqual({
      status: "pending",
      displayName: "Beatriz Nogueira",
      councilRegion: "CRN-3",
      councilNumber: "12345",
      rejectionReason: null,
    });

    const list = await repo(admin).listProfessionals();
    const row = list.find((record) => record.userId === uid);
    expect(row).toMatchObject({ email: "beatriz@exemplo.com", status: "pending", reviewedAt: null });
    expect(typeof row?.requestedAt).toBe("string");

    await repo(admin).reject(uid, "name_mismatch");
    expect((await repo(uid).getMyAccess())?.professional).toMatchObject({
      status: "rejected",
      rejectionReason: "name_mismatch",
    });

    await repo(uid).requestAccess({ displayName: "Beatriz N. Souza", councilRegion: "CRN-3", councilNumber: "12345" });
    await repo(admin).approve(uid);
    await repo(admin).setSuspended(uid, true);
    expect((await repo(uid).getMyAccess())?.professional?.status).toBe("suspended");

    const audit = await repo(admin).listAudit();
    const mine = audit.filter((entry) => entry.targetUserId === uid);
    expect(mine.map((entry) => entry.action)).toEqual(["suspend", "approve", "reject"]);
    expect(mine[2]).toMatchObject({ displayName: "Beatriz Nogueira", council: "CRN-3 12345", reason: "name_mismatch" });
  });

  it("o administrador vê só o próprio pedido em getMyAccess, mesmo lendo os dos outros", async () => {
    const someone = await t.createUser("alguem@exemplo.com");
    await repo(someone).requestAccess({ displayName: "Alguém", councilRegion: "CRN-1", councilNumber: "1" });
    expect(await repo(admin).getMyAccess()).toEqual({ isAdmin: true, professional: null });
  });

  it("quem não é administrador recebe erro, não uma lista vazia", async () => {
    const uid = await t.createUser("intrusa@exemplo.com");
    await expect(repo(uid).listProfessionals()).rejects.toThrow(/not admin/);
    await expect(repo(uid).approve(uid)).rejects.toThrow(/not admin/);
    expect(await repo(uid).listAudit()).toEqual([]);
  });
});
