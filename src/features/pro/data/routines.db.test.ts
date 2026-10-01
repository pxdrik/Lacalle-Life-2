import { beforeAll, describe, expect, it } from "vitest";

import { createTestDb, type TestDb } from "@/test/supabase-db";

/**
 * Migração 0038 (Life Pro, Etapa 8b): o treino prescrito, num Postgres de
 * verdade. As mesmas regras do plano alimentar (`plans.db.test.ts`): o
 * paciente nunca vê rascunho; versão publicada nunca é sobrescrita; só
 * publica quem tem vínculo ativo e está aprovado. E os dias são opcionais:
 * sem escolha, nenhum (o paciente faz quando quiser).
 */
const EXERCISES = [
  {
    id: "e1",
    exerciseId: "agachamento-livre-com-barra",
    name: "Agachamento livre com barra",
    sets: [{ id: "s1", reps: 8, weightKg: 60, rpe: 8, durationSeconds: null }],
    restSeconds: 120,
    notes: "Desça até a coxa ficar paralela ao chão.",
  },
];

describe("treinos prescritos (0038)", () => {
  let t: TestDb;
  let admin: string;
  let rafael: string;
  let ana: string;
  let link: string;

  const q = <T,>(uid: string | null, sql: string, params: unknown[] = []) =>
    t.as(uid, (tx) => tx.query<T>(sql, params)).then((result) => result.rows);

  async function draft(routineId: string | null, name = "Treino A", exercises: unknown = EXERCISES, onLink = link) {
    const [row] = await q<{ save_routine_draft: string }>(
      rafael,
      "select public.save_routine_draft($1, $2, $3, '', $4)",
      [routineId, onLink, name, JSON.stringify(exercises)],
    );
    return row!.save_routine_draft;
  }

  beforeAll(async () => {
    t = await createTestDb();
    admin = await t.createUser("lacallepm@gmail.com");
    await t.db.query("insert into public.app_admins (user_id) values ($1)", [admin]);
    rafael = await t.createUser("rafael@exemplo.com");
    await q(rafael, "select public.request_professional_access('Rafael Moura', null, null, '012345-G', 'SP')");
    await q(admin, "select public.admin_review_professional($1, 'approve', null)", [rafael]);
    ana = await t.createUser("ana@exemplo.com");
    const [inv] = await q<{ token: string }>(rafael, "select token from public.create_invite('Ana')");
    const [accepted] = await q<{ accept_invite: string }>(ana, "select public.accept_invite($1, true, true, true)", [
      inv!.token,
    ]);
    link = accepted!.accept_invite;
  });

  it("rascunho: o treinador lê, o paciente não vê nada", async () => {
    const routine = await draft(null);
    expect(
      await q(rafael, "select name, weekdays from public.prescribed_routine_drafts where routine_id = $1", [routine]),
    ).toEqual([{ name: "Treino A", weekdays: [] }]);
    expect(await q(ana, "select 1 from public.prescribed_routine_drafts")).toEqual([]);
    expect(await q(ana, "select 1 from public.prescribed_routine_versions where routine_id = $1", [routine])).toEqual(
      [],
    );
  });

  it("publicar cria versões novas sem sobrescrever; o paciente lê, com os dias e a nota", async () => {
    const routine = await draft(null);
    await q(rafael, "select public.publish_routine($1, '')", [routine]);
    await q(
      rafael,
      "select public.save_routine_draft($1, $2, 'Treino A', 'Aqueça antes.', $3, array['tue', 'thu']::text[])",
      [routine, link, JSON.stringify(EXERCISES)],
    );
    const [v2] = await q<{ publish_routine: number }>(rafael, "select public.publish_routine($1, 'Dias fixos')", [
      routine,
    ]);
    expect(v2!.publish_routine).toBe(2);

    const versions = await q<{ version: number; weekdays: string[]; notes: string; change_note: string }>(
      ana,
      "select version, weekdays, notes, change_note from public.prescribed_routine_versions where routine_id = $1 order by version",
      [routine],
    );
    expect(versions).toEqual([
      { version: 1, weekdays: [], notes: "", change_note: "" },
      { version: 2, weekdays: ["tue", "thu"], notes: "Aqueça antes.", change_note: "Dias fixos" },
    ]);
    expect(await q(rafael, "select 1 from public.prescribed_routine_drafts where routine_id = $1", [routine])).toEqual(
      [],
    );
    await expect(q(rafael, "select public.publish_routine($1, '')", [routine])).rejects.toThrow(/no draft/);
  });

  it("ninguém edita versão publicada, nem o treinador", async () => {
    const routine = await draft(null);
    await q(rafael, "select public.publish_routine($1, '')", [routine]);
    await expect(
      q(rafael, "update public.prescribed_routine_versions set exercises = '[]' where routine_id = $1", [routine]),
    ).rejects.toThrow(/permission denied/);
    await expect(
      q(ana, "delete from public.prescribed_routine_versions where routine_id = $1", [routine]),
    ).rejects.toThrow(/permission denied/);
  });

  it("outra pessoa não vê nem publica; sem vínculo não cria; dia inválido é recusado", async () => {
    const routine = await draft(null);
    await q(rafael, "select public.publish_routine($1, '')", [routine]);
    const intrusa = await t.createUser("intrusa@exemplo.com");
    expect(await q(intrusa, "select 1 from public.prescribed_routines where id = $1", [routine])).toEqual([]);
    expect(
      await q(intrusa, "select 1 from public.prescribed_routine_versions where routine_id = $1", [routine]),
    ).toEqual([]);
    await expect(q(intrusa, "select public.publish_routine($1, '')", [routine])).rejects.toThrow(/not found/);
    await expect(q(intrusa, "select public.save_routine_draft(null, $1, 'X', '', '[]')", [link])).rejects.toThrow(
      /no active link/,
    );
    await expect(
      q(rafael, "select public.save_routine_draft($1, $2, 'X', '', '[]', array['domingo']::text[])", [routine, link]),
    ).rejects.toThrow(/invalid weekdays/);
  });

  it("encerrado o vínculo: o paciente segue lendo, o treinador não publica mais", async () => {
    const bia = await t.createUser("bia@exemplo.com");
    const [inv] = await q<{ token: string }>(rafael, "select token from public.create_invite('Bia')");
    const [accepted] = await q<{ accept_invite: string }>(bia, "select public.accept_invite($1, true, true, true)", [
      inv!.token,
    ]);
    const biaLink = accepted!.accept_invite;
    const routine = await draft(null, "Treino Bia", EXERCISES, biaLink);
    await q(rafael, "select public.publish_routine($1, '')", [routine]);
    await q(bia, "select public.end_link($1)", [biaLink]);

    expect(
      await q(bia, "select version from public.prescribed_routine_versions where routine_id = $1", [routine]),
    ).toEqual([{ version: 1 }]);
    await expect(draft(routine, "Treino Bia", [], biaLink)).rejects.toThrow(/no active link/);
  });

  it("o banco recusa o que não pode ser treino", async () => {
    await expect(draft(null, "X", { not: "a list" })).rejects.toThrow(/invalid routine/);
    await expect(draft(null, "X", Array.from({ length: 41 }, (_, i) => ({ id: String(i) })))).rejects.toThrow(
      /too many exercises/,
    );
    await expect(draft(null, "X", [{ id: "big", notes: "x".repeat(200_001) }])).rejects.toThrow(/routine too large/);
  });
});
