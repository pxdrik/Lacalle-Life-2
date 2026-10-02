import { beforeAll, describe, expect, it } from "vitest";

import { createTestDb, type TestDb } from "@/test/supabase-db";

/**
 * Migração 0039 (Life Pro, Etapa 6): o treinador lê o que o paciente faz, só
 * o que ele libera. O que se defende: cada leitura confere o item liberado e
 * o vínculo ativo; desligar vale na hora; outro treinador e o próprio
 * paciente não leem por aqui; lápide e treino em andamento não aparecem; o
 * aceite e a mudança de antes (sem o item novo) continuam funcionando.
 */
const DAY = 86_400_000;
const NOW = Date.parse("2026-10-02T10:00:00Z");

describe("acompanhamento do treinador (0039)", () => {
  let t: TestDb;
  let rafael: string;
  let outro: string;
  let ana: string;
  let linkId: string;

  async function approvedPro(admin: string, email: string): Promise<string> {
    const uid = await t.createUser(email);
    await t.as(uid, (tx) => tx.query("select public.request_professional_access('Pro', 'CRN-3', '1', null, null)"));
    await t.as(admin, (tx) => tx.query("select public.admin_review_professional($1, 'approve', null)", [uid]));
    return uid;
  }

  const read = <T>(uid: string, sql: string, params: unknown[] = []) =>
    t.as(uid, (tx) => tx.query<T>(sql, params)).then((r) => r.rows);

  async function share(diary: boolean, body: boolean, workouts: boolean | null) {
    await t.as(ana, (tx) =>
      tx.query("select public.update_link_sharing($1, $2, $3, false, $4)", [linkId, diary, body, workouts]),
    );
  }

  beforeAll(async () => {
    t = await createTestDb();
    const admin = await t.createUser("lacallepm@gmail.com");
    await t.db.query("insert into public.app_admins (user_id) values ($1)", [admin]);
    rafael = await approvedPro(admin, "rafael@exemplo.com");
    outro = await approvedPro(admin, "outro@exemplo.com");
    ana = await t.createUser("ana@exemplo.com");
    const invite = await read<{ token: string }>(rafael, "select token from public.create_invite('Ana')");
    const [accepted] = await read<{ accept_invite: string }>(
      ana,
      "select public.accept_invite($1, true, true, false, true)",
      [invite[0]!.token],
    );
    linkId = accepted!.accept_invite;

    const session = (id: string, startedAt: number, finishedAt: number | null, deleted = false) =>
      t.db.query(
        `insert into public.workout_sessions (id, user_id, routine_id, name, started_at, finished_at, payload, client_updated_at, deleted_at)
         values ($1, $2, null, 'Treino A', $3, $4, '{"exercises":[]}', $3, $5)`,
        [id, ana, startedAt, finishedAt, deleted ? new Date().toISOString() : null],
      );
    await session("00000000-0000-4000-8000-000000000001", NOW - 2 * DAY, NOW - 2 * DAY + 3_000_000);
    await session("00000000-0000-4000-8000-000000000002", NOW - DAY, null);
    await session("00000000-0000-4000-8000-000000000003", NOW - 3 * DAY, NOW - 3 * DAY + 1, true);
    await session("00000000-0000-4000-8000-000000000004", NOW - 40 * DAY, NOW - 40 * DAY + 1);

    for (const [day, deleted] of [["2026-10-01", false], ["2026-09-30", true]] as const) {
      await t.db.query(
        `insert into public.food_logs (user_id, day, payload, client_updated_at, deleted_at)
         values ($1, $2, '{"meals":[],"dietId":null}', 1, $3)`,
        [ana, day, deleted ? new Date().toISOString() : null],
      );
    }
    await t.db.query(
      `insert into public.body_entries (user_id, day, weight_kg, measurements, client_updated_at)
       values ($1, current_date - 40, 71.8, '{"waist":78}', 1), ($1, current_date - 1, 68.6, '{"waist":74.5}', 1)`,
      [ana],
    );
  });

  it("lê os treinos finalizados desde a data, sem lápide e sem treino em andamento", async () => {
    const rows = await read<{ id: string }>(rafael, "select id from public.pro_patient_sessions($1, $2)", [linkId, NOW - 30 * DAY]);
    expect(rows.map((row) => row.id)).toEqual(["00000000-0000-4000-8000-000000000001"]);
  });

  it("lê o diário no intervalo, sem lápide, e recusa intervalo grande demais", async () => {
    const rows = await read<{ day: string }>(rafael, "select day::text from public.pro_patient_diary($1, '2026-09-25', '2026-10-02')", [linkId]);
    expect(rows.map((row) => row.day)).toEqual(["2026-10-01"]);
    await expect(read(rafael, "select * from public.pro_patient_diary($1, '2026-01-01', '2026-10-02')", [linkId])).rejects.toThrow(
      /invalid range/,
    );
  });

  it("lê peso e medidas, do mais antigo ao mais novo", async () => {
    const rows = await read<{ weight_kg: string }>(rafael, "select weight_kg::text from public.pro_patient_body($1)", [linkId]);
    expect(rows.map((row) => row.weight_kg)).toEqual(["71.8", "68.6"]);
  });

  it("a Visão geral traz só o que é liberado", async () => {
    const [row] = await read<{ last_session_at: string; sessions: unknown[]; last_diary_day: string; weight_now: string; weight_month_ago: string }>(
      rafael,
      "select last_session_at::text, sessions, last_diary_day::text, weight_now::text, weight_month_ago::text from public.pro_overview($1)",
      [NOW - 7 * DAY],
    );
    expect(row).toMatchObject({
      last_session_at: String(NOW - 2 * DAY),
      last_diary_day: "2026-10-01",
      weight_now: "68.6",
      weight_month_ago: "71.8",
    });
    expect(row!.sessions).toEqual([{ routineId: null, startedAt: NOW - 2 * DAY }]);
  });

  it("desligar vale na hora, item por item, e a Visão geral esvazia o que saiu", async () => {
    await share(true, false, false);
    await expect(read(rafael, "select * from public.pro_patient_sessions($1, 0)", [linkId])).rejects.toThrow(/not shared/);
    await expect(read(rafael, "select * from public.pro_patient_body($1)", [linkId])).rejects.toThrow(/not shared/);
    expect(await read(rafael, "select day from public.pro_patient_diary($1, '2026-09-25', '2026-10-02')", [linkId])).toHaveLength(1);
    const [row] = await read<{ sessions: unknown; weight_now: unknown; last_diary_day: unknown }>(
      rafael,
      "select sessions, weight_now, last_diary_day::text from public.pro_overview(0)",
    );
    expect(row).toEqual({ sessions: null, weight_now: null, last_diary_day: "2026-10-01" });
    await share(true, true, true);
  });

  it("mudar o que libera sem o item novo (a prévia de antes) mantém os treinos como estavam", async () => {
    await t.as(ana, (tx) => tx.query("select public.update_link_sharing($1, true, true, false)", [linkId]));
    const [link] = await t.db.query<{ share_workouts: boolean }>("select share_workouts from public.care_links where id = $1", [linkId]).then((r) => r.rows);
    expect(link!.share_workouts).toBe(true);
    const [mine] = await read<{ share_workouts: boolean }>(ana, "select share_workouts from public.my_care_links()");
    expect(mine!.share_workouts).toBe(true);
  });

  it("outro treinador e o próprio paciente não leem por aqui", async () => {
    for (const uid of [outro, ana]) {
      await expect(read(uid, "select * from public.pro_patient_sessions($1, 0)", [linkId])).rejects.toThrow(/no active link/);
      await expect(read(uid, "select * from public.pro_patient_diary($1, '2026-09-25', '2026-10-02')", [linkId])).rejects.toThrow(/no active link/);
      await expect(read(uid, "select * from public.pro_patient_body($1)", [linkId])).rejects.toThrow(/no active link/);
    }
    expect(await read(outro, "select * from public.pro_overview(0)")).toEqual([]);
    await expect(read(ana, "select * from public.pro_overview(0)")).rejects.toThrow(/not an approved professional/);
  });

  it("encerrado o vínculo, nada mais é lido, nem pela Visão geral", async () => {
    await t.as(ana, (tx) => tx.query("select public.end_link($1)", [linkId]));
    await expect(read(rafael, "select * from public.pro_patient_sessions($1, 0)", [linkId])).rejects.toThrow(/no active link/);
    expect(await read(rafael, "select * from public.pro_overview(0)")).toEqual([]);
  });

  it("aceite sem o item novo (a prévia de antes) deixa Treinos desligado", async () => {
    const invite = await read<{ token: string }>(outro, "select token from public.create_invite('Ana')");
    const [accepted] = await read<{ accept_invite: string }>(ana, "select public.accept_invite($1, true, true, false)", [invite[0]!.token]);
    const [link] = await t.db
      .query<{ share_workouts: boolean }>("select share_workouts from public.care_links where id = $1", [accepted!.accept_invite])
      .then((r) => r.rows);
    expect(link!.share_workouts).toBe(false);
  });
});
