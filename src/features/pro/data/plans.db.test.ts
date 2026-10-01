import { beforeAll, describe, expect, it } from "vitest";

import { createTestDb, type TestDb } from "@/test/supabase-db";

/**
 * Migração 0035 (Life Pro, Etapa 5): rascunho, publicação e modelos, num
 * Postgres de verdade. O que se defende (especificação, seção 8): o paciente
 * nunca vê rascunho; versão publicada nunca é sobrescrita; só publica quem tem
 * vínculo ativo e está aprovada; o paciente decide os dias; modelo é da
 * profissional e independe dos planos.
 */
const MEALS = [
  {
    id: "m1",
    name: "Café da manhã",
    time: "07:30",
    notes: "A banana pode ser trocada por mamão.",
    items: [],
    alternatives: [{ id: "a1", name: "Pão com ovo", items: [] }],
  },
];

describe("planos (0035)", () => {
  let t: TestDb;
  let admin: string;
  let marina: string;
  let ana: string;
  let link: string;

  const q = <T,>(uid: string | null, sql: string, params: unknown[] = []) =>
    t.as(uid, (tx) => tx.query<T>(sql, params)).then((result) => result.rows);

  async function draft(planId: string | null, name = "Recomposição", meals: unknown = MEALS) {
    const [row] = await q<{ save_plan_draft: string }>(marina, "select public.save_plan_draft($1, $2, $3, $4)", [
      planId,
      link,
      name,
      JSON.stringify(meals),
    ]);
    return row!.save_plan_draft;
  }

  beforeAll(async () => {
    t = await createTestDb();
    admin = await t.createUser("lacallepm@gmail.com");
    await t.db.query("insert into public.app_admins (user_id) values ($1)", [admin]);
    marina = await t.createUser("marina@exemplo.com");
    await q(marina, "select public.request_professional_access('Marina Faria', 'CRN-3', '1', null, null)");
    await q(admin, "select public.admin_review_professional($1, 'approve', null)", [marina]);
    ana = await t.createUser("ana@exemplo.com");
    const [inv] = await q<{ token: string }>(marina, "select token from public.create_invite('Ana')");
    const [accepted] = await q<{ accept_invite: string }>(ana, "select public.accept_invite($1, true, true, true)", [
      inv!.token,
    ]);
    link = accepted!.accept_invite;
  });

  it("rascunho: a profissional lê, o paciente não vê nada", async () => {
    const plan = await draft(null);
    expect(await q(marina, "select name from public.prescribed_plan_drafts where plan_id = $1", [plan])).toEqual([
      { name: "Recomposição" },
    ]);
    expect(await q(ana, "select 1 from public.prescribed_plan_drafts")).toEqual([]);
    expect(await q(ana, "select 1 from public.prescribed_plan_versions where plan_id = $1", [plan])).toEqual([]);
  });

  it("publicar cria versões novas sem sobrescrever; o paciente lê; sem dias escolhidos, todos", async () => {
    const plan = await draft(null);
    await q(marina, "select public.publish_plan($1, '')", [plan]);
    await draft(plan, "Recomposição", [{ ...MEALS[0], notes: "Agora com mamão." }]);
    const [v2] = await q<{ publish_plan: number }>(marina, "select public.publish_plan($1, 'Troquei a fruta')", [plan]);
    expect(v2!.publish_plan).toBe(2);

    const versions = await q<{ version: number; change_note: string; meals: { notes: string }[] }>(
      ana,
      "select version, change_note, meals from public.prescribed_plan_versions where plan_id = $1 order by version",
      [plan],
    );
    expect(versions.map((v) => [v.version, v.change_note, v.meals[0]!.notes])).toEqual([
      [1, "", "A banana pode ser trocada por mamão."],
      [2, "Troquei a fruta", "Agora com mamão."],
    ]);
    // Os dias moram na versão desde a 0036; sem escolha, todos.
    expect(
      await q(ana, "select weekdays from public.prescribed_plan_versions where plan_id = $1 order by version", [plan]),
    ).toEqual([
      { weekdays: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] },
      { weekdays: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] },
    ]);
    // publicar consumiu o rascunho
    expect(await q(marina, "select 1 from public.prescribed_plan_drafts where plan_id = $1", [plan])).toEqual([]);
  });

  it("ninguém edita versão publicada, nem a profissional", async () => {
    const plan = await draft(null);
    await q(marina, "select public.publish_plan($1, '')", [plan]);
    await expect(
      q(marina, "update public.prescribed_plan_versions set meals = '[]' where plan_id = $1", [plan]),
    ).rejects.toThrow(/permission denied/);
    await expect(q(ana, "delete from public.prescribed_plan_versions where plan_id = $1", [plan])).rejects.toThrow(
      /permission denied/,
    );
  });

  it("os dias são da profissional (0036): vão no rascunho e na versão, e o paciente não muda", async () => {
    const [row] = await q<{ save_plan_draft: string }>(
      marina,
      "select public.save_plan_draft(null, $1, 'Recomposição', $2, array['mon', 'wed', 'fri']::text[])",
      [link, JSON.stringify(MEALS)],
    );
    const plan = row!.save_plan_draft;
    await q(marina, "select public.publish_plan($1, '')", [plan]);
    expect(await q(ana, "select weekdays from public.prescribed_plan_versions where plan_id = $1", [plan])).toEqual([
      { weekdays: ["mon", "wed", "fri"] },
    ]);
    await expect(q(ana, "select public.set_plan_schedule($1, array['sun']::text[])", [plan])).rejects.toThrow(
      /permission denied/,
    );
    await expect(
      q(marina, "select public.save_plan_draft($1, $2, 'X', '[]', array['domingo']::text[])", [plan, link]),
    ).rejects.toThrow(/invalid weekdays/);
  });

  it("outra pessoa não vê nem publica o plano; profissional sem vínculo não cria", async () => {
    const plan = await draft(null);
    await q(marina, "select public.publish_plan($1, '')", [plan]);
    const intrusa = await t.createUser("intrusa@exemplo.com");
    expect(await q(intrusa, "select 1 from public.prescribed_plans where id = $1", [plan])).toEqual([]);
    expect(await q(intrusa, "select 1 from public.prescribed_plan_versions where plan_id = $1", [plan])).toEqual([]);
    await expect(q(intrusa, "select public.publish_plan($1, '')", [plan])).rejects.toThrow(/not found/);
    await expect(
      q(intrusa, "select public.save_plan_draft(null, $1, 'X', '[]')", [link]),
    ).rejects.toThrow(/no active link/);
  });

  it("encerrado o vínculo: o paciente segue lendo, a profissional não publica mais", async () => {
    const bia = await t.createUser("bia@exemplo.com");
    const [inv] = await q<{ token: string }>(marina, "select token from public.create_invite('Bia')");
    const [accepted] = await q<{ accept_invite: string }>(bia, "select public.accept_invite($1, true, true, true)", [
      inv!.token,
    ]);
    const biaLink = accepted!.accept_invite;
    const [made] = await q<{ save_plan_draft: string }>(marina, "select public.save_plan_draft(null, $1, 'Plano Bia', $2)", [
      biaLink,
      JSON.stringify(MEALS),
    ]);
    const plan = made!.save_plan_draft;
    await q(marina, "select public.publish_plan($1, '')", [plan]);
    await q(bia, "select public.end_link($1)", [biaLink]);

    expect(await q(bia, "select version from public.prescribed_plan_versions where plan_id = $1", [plan])).toEqual([
      { version: 1 },
    ]);
    await expect(
      q(marina, "select public.save_plan_draft($1, $2, 'Plano Bia', '[]')", [plan, biaLink]),
    ).rejects.toThrow(/no active link/);
  });

  it("o banco recusa o que não pode ser plano", async () => {
    await expect(draft(null, "X", { not: "a list" })).rejects.toThrow(/invalid plan/);
    await expect(draft(null, "X", Array.from({ length: 21 }, (_, i) => ({ id: String(i) })))).rejects.toThrow(
      /too many meals/,
    );
    await expect(draft(null, "X", [{ id: "big", notes: "x".repeat(200_001) }])).rejects.toThrow(/plan too large/);
  });

  it("modelos: só os próprios, e mudar o modelo não mexe no plano", async () => {
    const [made] = await q<{ save_plan_template: string }>(marina, "select public.save_plan_template(null, 'Déficit', $1)", [
      JSON.stringify(MEALS),
    ]);
    const template = made!.save_plan_template;
    expect(await q(ana, "select 1 from public.plan_templates")).toEqual([]);
    await expect(q(ana, "select public.save_plan_template(null, 'X', '[]')")).rejects.toThrow(
      /not an approved professional/,
    );

    const plan = await draft(null, "A partir do modelo", MEALS);
    await q(marina, "select public.publish_plan($1, '')", [plan]);
    await q(marina, "select public.save_plan_template($1, 'Déficit', '[]')", [template]);
    const [published] = await q<{ meals: unknown[] }>(
      ana,
      "select meals from public.prescribed_plan_versions where plan_id = $1",
      [plan],
    );
    expect(published!.meals).toHaveLength(1);

    const paulo = await t.createUser("paulo@exemplo.com");
    await q(paulo, "select public.request_professional_access('Paulo', 'CRN-1', '2', null, null)");
    await q(admin, "select public.admin_review_professional($1, 'approve', null)", [paulo]);
    await expect(q(paulo, "select public.delete_plan_template($1)", [template])).rejects.toThrow(/not found/);
    await q(marina, "select public.delete_plan_template($1)", [template]);
  });
});
