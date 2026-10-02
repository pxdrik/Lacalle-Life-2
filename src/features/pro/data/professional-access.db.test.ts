import { beforeAll, describe, expect, it } from "vitest";

import { createTestDb, type TestDb } from "@/test/supabase-db";

/**
 * Migração 0033 (Life Pro, Etapa 1): pedido de acesso, aprovação e
 * administrador, num Postgres de verdade. A regra que cada teste defende é a
 * mesma da especificação (`docs/visao-adm-pro.md`, seção 12): ninguém muda a
 * própria permissão, e só o administrador decide.
 */
type Status = { status: string; rejection_reason: string | null; reviewed_by: string | null };

async function request(t: TestDb, uid: string, name = "Beatriz Nogueira") {
  return t.as(uid, (tx) =>
    tx.query<{ request_professional_access: string }>(
      "select public.request_professional_access($1, 'CRN-3', '12345', null, null)",
      [name],
    ),
  );
}

async function statusOf(t: TestDb, uid: string): Promise<Status | undefined> {
  const { rows } = await t.db.query<Status>(
    "select status, rejection_reason, reviewed_by from public.professional_profiles where user_id = $1",
    [uid],
  );
  return rows[0];
}

describe("pedido de acesso e administrador (0033)", () => {
  let t: TestDb;
  let admin: string;

  beforeAll(async () => {
    t = await createTestDb();
    admin = await t.createUser("lacallepm@gmail.com");
    // A migração só acha a conta se ela já existir; aqui ela nasce depois,
    // então o administrador é marcado como seria em produção: direto no banco.
    await t.db.query("insert into public.app_admins (user_id) values ($1)", [admin]);
  });

  it("o pedido nasce em análise, e a pessoa lê o próprio pedido", async () => {
    const uid = await t.createUser("beatriz@exemplo.com");
    const { rows } = await request(t, uid);
    expect(rows[0]!.request_professional_access).toBe("pending");
    const own = await t.as(uid, (tx) => tx.query<Status>("select status from public.professional_profiles"));
    expect(own.rows).toEqual([{ status: "pending" }]);
  });

  it("ninguém se aprova: escrita direta é recusada", async () => {
    const uid = await t.createUser("esperta@exemplo.com");
    await request(t, uid);
    await expect(
      t.as(uid, (tx) => tx.query("update public.professional_profiles set status = 'approved' where user_id = auth.uid()")),
    ).rejects.toThrow(/permission denied/);
    await expect(
      t.as(uid, (tx) =>
        tx.query(
          "insert into public.professional_profiles (user_id, profession, display_name, council_region, council_number, status) values (auth.uid(), 'trainer', 'X Y', 'CRN-3', '1', 'approved')",
        ),
      ),
    ).rejects.toThrow(/permission denied/);
    expect((await statusOf(t, uid))?.status).toBe("pending");
  });

  it("ninguém se faz administrador, nem descobre quem é", async () => {
    const uid = await t.createUser("curioso@exemplo.com");
    await expect(
      t.as(uid, (tx) => tx.query("insert into public.app_admins (user_id) values (auth.uid())")),
    ).rejects.toThrow(/permission denied/);
    await expect(t.as(uid, (tx) => tx.query("select * from public.app_admins"))).rejects.toThrow(
      /permission denied/,
    );
    const isAdmin = await t.as(uid, (tx) => tx.query<{ is_admin: boolean }>("select public.is_admin()"));
    expect(isAdmin.rows[0]!.is_admin).toBe(false);
  });

  it("quem não é administrador não chama as funções de administrador", async () => {
    const pro = await t.createUser("pro1@exemplo.com");
    await request(t, pro);
    const other = await t.createUser("outro@exemplo.com");
    await expect(
      t.as(other, (tx) => tx.query("select public.admin_review_professional($1, 'approve', null)", [pro])),
    ).rejects.toThrow(/not admin/);
    await expect(
      t.as(pro, (tx) => tx.query("select public.admin_review_professional($1, 'approve', null)", [pro])),
    ).rejects.toThrow(/not admin/);
    await expect(t.as(other, (tx) => tx.query("select * from public.admin_list_professionals()"))).rejects.toThrow(
      /not admin/,
    );
    await expect(
      t.as(null, (tx) => tx.query("select public.admin_review_professional($1, 'approve', null)", [pro])),
    ).rejects.toThrow(/permission denied/);
    expect((await statusOf(t, pro))?.status).toBe("pending");
  });

  it("um não vê o pedido do outro; o administrador vê todos, com e-mail", async () => {
    const a = await t.createUser("pa@exemplo.com");
    const b = await t.createUser("pb@exemplo.com");
    await request(t, a);
    await request(t, b);
    const seenByA = await t.as(a, (tx) => tx.query<{ user_id: string }>("select user_id from public.professional_profiles"));
    expect(seenByA.rows.map((row) => row.user_id)).toEqual([a]);
    const anon = await t.as(null, (tx) => tx.query("select 1 from public.professional_profiles"));
    expect(anon.rows).toHaveLength(0);
    const list = await t.as(admin, (tx) =>
      tx.query<{ user_id: string; email: string }>("select user_id, email from public.admin_list_professionals()"),
    );
    expect(list.rows).toEqual(expect.arrayContaining([{ user_id: a, email: "pa@exemplo.com" }]));
  });

  it("o administrador aprova, e a decisão vai para o histórico", async () => {
    const pro = await t.createUser("marina@exemplo.com");
    await request(t, pro, "Marina Faria");
    await t.as(admin, (tx) => tx.query("select public.admin_review_professional($1, 'approve', null)", [pro]));
    expect(await statusOf(t, pro)).toEqual({ status: "approved", rejection_reason: null, reviewed_by: admin });
    const log = await t.as(admin, (tx) =>
      tx.query<{ action: string; actor_id: string; detail: { display_name: string; council: string } }>(
        "select action, actor_id, detail from public.admin_audit_log where target_user_id = $1",
        [pro],
      ),
    );
    expect(log.rows).toEqual([
      { action: "approve", actor_id: admin, detail: { display_name: "Marina Faria", council: "CRN-3 12345", reason: null } },
    ]);
    // O histórico é só do administrador.
    const peek = await t.as(pro, (tx) => tx.query("select 1 from public.admin_audit_log"));
    expect(peek.rows).toHaveLength(0);
  });

  it("recusar exige motivo, a pessoa vê o motivo e pode reenviar", async () => {
    const pro = await t.createUser("carlos@exemplo.com");
    await request(t, pro, "Carlos Mendes");
    await expect(
      t.as(admin, (tx) => tx.query("select public.admin_review_professional($1, 'reject', null)", [pro])),
    ).rejects.toThrow(/reason required/);
    await t.as(admin, (tx) =>
      tx.query("select public.admin_review_professional($1, 'reject', 'council_not_found')", [pro]),
    );
    const seen = await t.as(pro, (tx) =>
      tx.query<{ status: string; rejection_reason: string }>(
        "select status, rejection_reason from public.professional_profiles",
      ),
    );
    expect(seen.rows).toEqual([{ status: "rejected", rejection_reason: "council_not_found" }]);
    await request(t, pro, "Carlos Mendes");
    expect(await statusOf(t, pro)).toEqual({ status: "pending", rejection_reason: null, reviewed_by: null });
  });

  it("motivo fora da lista é recusado pelo banco", async () => {
    const pro = await t.createUser("lista@exemplo.com");
    await request(t, pro);
    await expect(
      t.as(admin, (tx) => tx.query("select public.admin_review_professional($1, 'reject', 'qualquer coisa')", [pro])),
    ).rejects.toThrow(/check constraint/);
    expect((await statusOf(t, pro))?.status).toBe("pending");
  });

  it("aprovado ou suspenso não reenvia pedido (não sai de suspensão assim)", async () => {
    const pro = await t.createUser("suspensa@exemplo.com");
    await request(t, pro);
    await t.as(admin, (tx) => tx.query("select public.admin_review_professional($1, 'approve', null)", [pro]));
    await expect(request(t, pro)).rejects.toThrow(/already reviewed/);
    await t.as(admin, (tx) => tx.query("select public.admin_set_professional_suspended($1, true)", [pro]));
    expect((await statusOf(t, pro))?.status).toBe("suspended");
    await expect(request(t, pro)).rejects.toThrow(/already reviewed/);
    await t.as(admin, (tx) => tx.query("select public.admin_set_professional_suspended($1, false)", [pro]));
    expect((await statusOf(t, pro))?.status).toBe("approved");
    const actions = await t.db.query<{ action: string }>(
      "select action from public.admin_audit_log where target_user_id = $1 order by id",
      [pro],
    );
    expect(actions.rows.map((row) => row.action)).toEqual(["approve", "suspend", "reactivate"]);
  });

  it("só aprova o que está em análise, e só suspende quem está aprovado", async () => {
    const pro = await t.createUser("ordem@exemplo.com");
    await request(t, pro);
    await expect(
      t.as(admin, (tx) => tx.query("select public.admin_set_professional_suspended($1, true)", [pro])),
    ).rejects.toThrow(/invalid transition/);
    await t.as(admin, (tx) => tx.query("select public.admin_review_professional($1, 'approve', null)", [pro]));
    await expect(
      t.as(admin, (tx) => tx.query("select public.admin_review_professional($1, 'reject', 'inactive')", [pro])),
    ).rejects.toThrow(/not pending/);
  });

  it("dados fora do formato são recusados pelo banco", async () => {
    const uid = await t.createUser("formato@exemplo.com");
    await expect(
      t.as(uid, (tx) => tx.query("select public.request_professional_access('Ana', 'CRN-99', '123', null, null)")),
    ).rejects.toThrow(/check constraint/);
    await expect(
      t.as(uid, (tx) => tx.query("select public.request_professional_access('Ana', 'CRN-3', '12a', null, null)")),
    ).rejects.toThrow(/check constraint/);
    await expect(
      t.as(uid, (tx) => tx.query("select public.request_professional_access('Ana', null, null, '12345-G', 'SP')")),
      "CREF com 5 dígitos",
    ).rejects.toThrow(/check constraint/);
    await expect(
      t.as(uid, (tx) => tx.query("select public.request_professional_access('Ana', null, null, '012345-G', 'São Paulo')")),
      "região do CREF fora da UF",
    ).rejects.toThrow(/check constraint/);
    await expect(
      t.as(uid, (tx) => tx.query("select public.request_professional_access('Ana', 'CRN-3', null, null, null)")),
      "região sem número",
    ).rejects.toThrow(/check constraint/);
    await expect(
      t.as(uid, (tx) => tx.query("select public.request_professional_access('Ana', null, null, null, null)")),
      "nenhum registro",
    ).rejects.toThrow(/some_council/);
  });

  it("treinador (0037): só CREF, ou os dois registros, e o histórico guarda os dois", async () => {
    const soCref = await t.createUser("cref@exemplo.com");
    await t.as(soCref, (tx) => tx.query("select public.request_professional_access('Rafael Moura', null, null, '012345-g', 'SP')"));
    const dois = await t.createUser("dois@exemplo.com");
    await t.as(dois, (tx) => tx.query("select public.request_professional_access('Marina Faria', 'CRN-3', '00001', '054321-P', 'RJ')"));

    const list = await t.as(admin, (tx) =>
      tx.query<{ user_id: string; profession: string; council_region: string | null; council_number: string | null; cref_number: string | null; cref_region: string | null }>(
        "select user_id, profession, council_region, council_number, cref_number, cref_region from public.admin_list_professionals()",
      ),
    );
    const row = (uid: string) => list.rows.find((r) => r.user_id === uid);
    expect(row(soCref)).toMatchObject({ profession: "trainer", council_region: null, council_number: null, cref_number: "012345-G", cref_region: "SP" });
    expect(row(dois)).toMatchObject({ council_region: "CRN-3", council_number: "00001", cref_number: "054321-P", cref_region: "RJ" });

    await t.as(admin, (tx) => tx.query("select public.admin_review_professional($1, 'approve', null)", [dois]));
    const audit = await t.db.query<{ council: string }>(
      "select detail->>'council' as council from public.admin_audit_log where target_user_id = $1",
      [dois],
    );
    expect(audit.rows).toEqual([{ council: "CRN-3 00001 · CREF 054321-P/RJ" }]);
  });

  it("visitante sem conta não pede acesso", async () => {
    await expect(
      t.as(null, (tx) => tx.query("select public.request_professional_access('Ana', 'CRN-3', '1', null, null)")),
    ).rejects.toThrow(/permission denied/);
  });
});
