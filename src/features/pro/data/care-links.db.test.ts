import { beforeAll, describe, expect, it } from "vitest";

import { createTestDb, type TestDb } from "@/test/supabase-db";

/**
 * Migração 0034 (Life Pro, Etapa 4): convite por link e vínculo, num Postgres
 * de verdade. O que se defende: só profissional aprovado convida; o código
 * vale uma vez e vence; só o paciente decide o que libera; qualquer um dos
 * dois encerra; ninguém de fora enxerga vínculo alheio.
 */
type Invite = { invite_id: string; token: string };
type Link = {
  id: string;
  status: string;
  share_diary: boolean;
  share_body: boolean;
  share_profile: boolean;
  patient_label: string;
};

describe("vínculos e convites (0034)", () => {
  let t: TestDb;
  let admin: string;
  let marina: string;

  async function approvedPro(email: string, name: string): Promise<string> {
    const uid = await t.createUser(email);
    await t.as(uid, (tx) =>
      tx.query("select public.request_professional_access('nutritionist', $1, 'CRN-3', '12345')", [name]),
    );
    await t.as(admin, (tx) => tx.query("select public.admin_review_professional($1, 'approve', null)", [uid]));
    return uid;
  }

  async function invite(pro: string, label = "Ana Luísa Prado"): Promise<Invite> {
    const { rows } = await t.as(pro, (tx) =>
      tx.query<Invite>("select invite_id, token from public.create_invite($1)", [label]),
    );
    return rows[0]!;
  }

  async function accept(uid: string, token: string, diary = true, body = true, profile = false) {
    const { rows } = await t.as(uid, (tx) =>
      tx.query<{ accept_invite: string }>("select public.accept_invite($1, $2, $3, $4)", [token, diary, body, profile]),
    );
    return rows[0]!.accept_invite;
  }

  async function linkOf(id: string): Promise<Link> {
    const { rows } = await t.db.query<Link>(
      "select id, status, share_diary, share_body, share_profile, patient_label from public.care_links where id = $1",
      [id],
    );
    return rows[0]!;
  }

  beforeAll(async () => {
    t = await createTestDb();
    admin = await t.createUser("lacallepm@gmail.com");
    await t.db.query("insert into public.app_admins (user_id) values ($1)", [admin]);
    marina = await approvedPro("marina@exemplo.com", "Marina Faria");
  });

  it("só profissional aprovado gera convite; o banco guarda o hash, não o código", async () => {
    const pending = await t.createUser("pendente@exemplo.com");
    await t.as(pending, (tx) =>
      tx.query("select public.request_professional_access('nutritionist', 'Em Análise', 'CRN-3', '1')"),
    );
    await expect(t.as(pending, (tx) => tx.query("select * from public.create_invite('X')"))).rejects.toThrow(
      /not an approved professional/,
    );
    const common = await t.createUser("comum@exemplo.com");
    await expect(t.as(common, (tx) => tx.query("select * from public.create_invite('X')"))).rejects.toThrow(
      /not an approved professional/,
    );

    const { invite_id, token } = await invite(marina);
    expect(token).toMatch(/^[0-9a-f]{32}$/);
    const stored = await t.db.query<{ token_hash: string }>("select token_hash from public.care_invites where id = $1", [
      invite_id,
    ]);
    expect(stored.rows[0]!.token_hash).not.toContain(token);
  });

  it("a página do convite mostra quem convidou, até para visitante, e nada de código errado", async () => {
    const { token } = await invite(marina);
    const seen = await t.as(null, (tx) =>
      tx.query<{ state: string; professional_name: string; council: string }>(
        "select state, professional_name, council from public.get_invite($1)",
        [token],
      ),
    );
    expect(seen.rows).toEqual([{ state: "valid", professional_name: "Marina Faria", council: "CRN-3 12345" }]);
    const wrong = await t.as(null, (tx) =>
      tx.query<{ state: string; professional_name: string | null }>(
        "select state, professional_name from public.get_invite('0000')",
      ),
    );
    expect(wrong.rows).toEqual([{ state: "invalid", professional_name: null }]);
  });

  it("aceitar cria o vínculo com o que o paciente liberou; o código não serve duas vezes", async () => {
    const ana = await t.createUser("ana@exemplo.com");
    const { token } = await invite(marina, "Ana Luísa Prado");
    const linkId = await accept(ana, token, true, false, true);
    expect(await linkOf(linkId)).toMatchObject({
      status: "active",
      share_diary: true,
      share_body: false,
      share_profile: true,
      patient_label: "Ana Luísa Prado",
    });

    const other = await t.createUser("outra@exemplo.com");
    await expect(accept(other, token)).rejects.toThrow(/invalid invite/);
    const state = await t.as(null, (tx) => tx.query<{ state: string }>("select state from public.get_invite($1)", [token]));
    expect(state.rows[0]!.state).toBe("used");
  });

  it("convite vencido ou cancelado não cria vínculo, e a profissional não aceita o próprio", async () => {
    const someone = await t.createUser("vencido@exemplo.com");
    const expired = await invite(marina);
    await t.db.query("update public.care_invites set expires_at = now() - interval '1 minute' where id = $1", [
      expired.invite_id,
    ]);
    await expect(accept(someone, expired.token)).rejects.toThrow(/invalid invite/);

    const cancelled = await invite(marina);
    await t.as(marina, (tx) => tx.query("select public.cancel_invite($1)", [cancelled.invite_id]));
    await expect(accept(someone, cancelled.token)).rejects.toThrow(/invalid invite/);

    const own = await invite(marina);
    await expect(accept(marina, own.token)).rejects.toThrow(/own invite/);
  });

  it("outra profissional não cancela o convite da Marina", async () => {
    const paulo = await approvedPro("paulo@exemplo.com", "Paulo Lima");
    const { invite_id } = await invite(marina);
    await expect(t.as(paulo, (tx) => tx.query("select public.cancel_invite($1)", [invite_id]))).rejects.toThrow(
      /not found/,
    );
  });

  it("só o paciente muda o que libera; qualquer um dos dois encerra; nada é apagado", async () => {
    const rafael = await t.createUser("rafael@exemplo.com");
    const linkId = await accept(rafael, (await invite(marina, "Rafael Moura")).token, true, true, true);

    await expect(
      t.as(marina, (tx) => tx.query("select public.update_link_sharing($1, true, true, true)", [linkId])),
    ).rejects.toThrow(/not found/);
    await t.as(rafael, (tx) => tx.query("select public.update_link_sharing($1, true, false, false)", [linkId]));
    expect(await linkOf(linkId)).toMatchObject({ share_diary: true, share_body: false, share_profile: false });

    await expect(
      t.as(rafael, (tx) => tx.query("update public.care_links set share_body = true where id = $1", [linkId])),
    ).rejects.toThrow(/permission denied/);

    await t.as(rafael, (tx) => tx.query("select public.end_link($1)", [linkId]));
    expect((await linkOf(linkId)).status).toBe("ended");
    await expect(
      t.as(rafael, (tx) => tx.query("select public.update_link_sharing($1, true, true, true)", [linkId])),
    ).rejects.toThrow(/not found/);
  });

  it("a profissional também encerra; um convite novo cria outro vínculo depois", async () => {
    const jorge = await t.createUser("jorge@exemplo.com");
    const first = await accept(jorge, (await invite(marina, "Jorge")).token);
    await t.as(marina, (tx) => tx.query("select public.end_link($1)", [first]));
    const second = await accept(jorge, (await invite(marina, "Jorge")).token);
    expect(second).not.toBe(first);
    expect((await linkOf(second)).status).toBe("active");
  });

  it("vínculo ativo repetido só atualiza o que é liberado", async () => {
    const camila = await t.createUser("camila@exemplo.com");
    const first = await accept(camila, (await invite(marina, "Camila")).token, true, false, false);
    const again = await accept(camila, (await invite(marina, "Camila")).token, false, true, false);
    expect(again).toBe(first);
    expect(await linkOf(first)).toMatchObject({ share_diary: false, share_body: true });
  });

  it("ninguém de fora vê vínculo nem convite; o administrador vê os vínculos", async () => {
    const leticia = await t.createUser("leticia@exemplo.com");
    const linkId = await accept(leticia, (await invite(marina, "Letícia")).token);
    const intrusa = await t.createUser("intrusa@exemplo.com");
    const outsiders = await t.as(intrusa, (tx) => tx.query("select 1 from public.care_links where id = $1", [linkId]));
    expect(outsiders.rows).toHaveLength(0);
    const invites = await t.as(intrusa, (tx) => tx.query("select 1 from public.care_invites"));
    expect(invites.rows).toHaveLength(0);
    const patientSees = await t.as(leticia, (tx) => tx.query("select 1 from public.care_invites"));
    expect(patientSees.rows, "o paciente não lê os convites da profissional").toHaveLength(0);
    const adminSees = await t.as(admin, (tx) => tx.query("select 1 from public.care_links where id = $1", [linkId]));
    expect(adminSees.rows).toHaveLength(1);
  });

  it("o paciente lista quem o acompanha, com nome e registro", async () => {
    const bia = await t.createUser("bia@exemplo.com");
    await accept(bia, (await invite(marina, "Bia")).token, true, true, false);
    const { rows } = await t.as(bia, (tx) =>
      tx.query<{ professional_name: string; council: string; share_diary: boolean }>(
        "select professional_name, council, share_diary from public.my_care_links()",
      ),
    );
    expect(rows).toEqual([{ professional_name: "Marina Faria", council: "CRN-3 12345", share_diary: true }]);
  });

  it("profissional suspensa: o convite dela deixa de valer", async () => {
    const pro = await approvedPro("susp@exemplo.com", "Suspensa");
    const { token } = await invite(pro);
    await t.as(admin, (tx) => tx.query("select public.admin_set_professional_suspended($1, true)", [pro]));
    const someone = await t.createUser("quer@exemplo.com");
    await expect(accept(someone, token)).rejects.toThrow(/invalid invite/);
    await expect(t.as(pro, (tx) => tx.query("select * from public.create_invite('X')"))).rejects.toThrow(
      /not an approved professional/,
    );
  });
});
