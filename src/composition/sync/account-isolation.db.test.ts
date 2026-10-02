import { beforeAll, describe, expect, it } from "vitest";

import { createTestDb, type TestDb } from "@/test/supabase-db";

/**
 * As regras de acesso de hoje, num Postgres de verdade (Etapa 0 do Life Pro,
 * `docs/visao-adm-plano.md`). Até aqui elas tinham sido conferidas só por
 * desenho. O que este arquivo prova, tabela por tabela:
 *
 * - a conta A lê o que é dela;
 * - a conta B não lê nada da A, e um visitante sem conta também não;
 * - ninguém escreve direto nas tabelas: só pelas funções `save_*`;
 * - a função de salvar não deixa B sobrescrever uma linha da A pelo id.
 *
 * Cada linha é gravada como superusuário (fora das regras), do jeito que o
 * servidor a guardaria; as leituras e escritas são feitas com o papel e o
 * usuário que o app usa.
 */
const TABLES = [
  "profiles",
  "body_entries",
  "diets",
  "food_logs",
  "routines",
  "workout_sessions",
  "user_custom_foods",
  "user_custom_exercises",
  "user_food_favorites",
  "user_exercise_favorites",
  "water_entries",
  "rest_days",
] as const;

async function seedEverything(t: TestDb, uid: string): Promise<{ dietId: string }> {
  const { rows } = await t.db.query<{ id: string }>("select gen_random_uuid() as id");
  const dietId = rows[0]!.id;
  const today = "2026-10-01";
  await t.db.exec(`
    insert into public.profiles (user_id, payload, client_updated_at) values ('${uid}', '{"goal":"maintain"}', 1);
    insert into public.body_entries (user_id, day, weight_kg, client_updated_at) values ('${uid}', '${today}', 70, 1);
    insert into public.diets (id, user_id, payload, client_updated_at) values ('${dietId}', '${uid}', '{"name":"A"}', 1);
    insert into public.food_logs (user_id, day, payload, client_updated_at) values ('${uid}', '${today}', '{"meals":[]}', 1);
    insert into public.routines (id, user_id, payload, client_updated_at) values (gen_random_uuid(), '${uid}', '{}', 1);
    insert into public.workout_sessions (id, user_id, name, started_at, finished_at, payload, client_updated_at)
      values (gen_random_uuid(), '${uid}', 'Push', 1, 2, '{}', 1);
    insert into public.user_custom_foods (id, user_id, payload, client_updated_at) values (gen_random_uuid(), '${uid}', '{}', 1);
    insert into public.user_custom_exercises (id, user_id, payload, client_updated_at) values (gen_random_uuid(), '${uid}', '{}', 1);
    insert into public.user_food_favorites (user_id, food_id) values ('${uid}', 'abacate');
    insert into public.user_exercise_favorites (user_id, exercise_id) values ('${uid}', 'supino');
    insert into public.water_entries (user_id, day, ml, client_updated_at) values ('${uid}', '${today}', 500, 1);
    insert into public.rest_days (user_id, day, client_updated_at) values ('${uid}', '${today}', 1);
  `);
  return { dietId };
}

describe("isolamento entre contas no banco (RLS)", () => {
  let t: TestDb;
  let a: string;
  let b: string;
  let dietId: string;

  beforeAll(async () => {
    t = await createTestDb();
    a = await t.createUser("a@exemplo.com");
    b = await t.createUser("b@exemplo.com");
    ({ dietId } = await seedEverything(t, a));
  }, 60_000);

  for (const table of TABLES) {
    it(`${table}: A lê o que é seu; B e o visitante não leem nada`, async () => {
      const own = await t.as(a, (tx) => tx.query(`select 1 from public.${table}`));
      expect(own.rows, "A não lê o próprio dado").toHaveLength(1);

      const other = await t.as(b, (tx) => tx.query(`select 1 from public.${table}`));
      expect(other.rows, "B leu dado da A").toHaveLength(0);

      const anon = await t.as(null, (tx) => tx.query(`select 1 from public.${table}`));
      expect(anon.rows, "visitante leu dado da A").toHaveLength(0);
    });
  }

  it("ninguém escreve direto nas tabelas sincronizadas, nem no próprio nome", async () => {
    await expect(
      t.as(a, (tx) =>
        tx.query(
          "insert into public.diets (id, user_id, payload, client_updated_at) values (gen_random_uuid(), auth.uid(), '{}', 1)",
        ),
      ),
    ).rejects.toThrow(/permission denied/);
    await expect(
      t.as(b, (tx) => tx.query("update public.diets set payload = '{}' where id = $1", [dietId])),
    ).rejects.toThrow(/permission denied/);
  });

  it("B não apaga dado da A", async () => {
    const deleted = await t.as(b, (tx) => tx.query("delete from public.diets where id = $1", [dietId]));
    expect(deleted.affectedRows ?? 0).toBe(0);
    const still = await t.db.query("select 1 from public.diets where id = $1", [dietId]);
    expect(still.rows).toHaveLength(1);
  });

  it("save_diet com o id de uma dieta da A não sobrescreve nada quando chamado por B", async () => {
    const result = await t.as(b, (tx) =>
      tx.query<{ applied: boolean | null }>("select * from public.save_diet($1, $2, $3, null)", [
        dietId,
        { name: "invadida" },
        2,
      ]),
    );
    expect(result.rows.every((row) => row.applied !== true)).toBe(true);
    const { rows } = await t.db.query<{ payload: { name: string } }>(
      "select payload from public.diets where id = $1",
      [dietId],
    );
    expect(rows[0]!.payload.name).toBe("A");
  });

  it("as funções de salvar recusam visitante sem conta", async () => {
    await expect(
      t.as(null, (tx) => tx.query("select * from public.save_diet(gen_random_uuid(), '{}', 1, null)")),
    ).rejects.toThrow(/permission denied|not authenticated/);
  });
});
