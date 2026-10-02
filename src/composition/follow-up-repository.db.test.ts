import { beforeAll, describe, expect, it } from "vitest";

import { createMealItem } from "@/features/diet/services/create-diet";
import type { Meal } from "@/features/diet/types/diet";
import { NOT_SHARED } from "@/features/pro/types/follow-up";
import { clientAs, createTestDb, type TestDb } from "@/test/supabase-db";

import { createFollowUpRepository } from "./follow-up-repository";

/**
 * O acompanhamento pela composição (Etapa 6), contra o banco de verdade: os
 * treinos no formato que o app grava viram a tela do treinador com as contas
 * do app; o diário é comparado com o plano pela origem da refeição e pelo
 * conteúdo; item não liberado volta como "não libera", não como erro.
 */
const DAY = 86_400_000;
const NOW = Date.parse("2026-10-02T10:00:00Z");
const PER_100G = { kcal: 200, proteinG: 10, carbsG: 20, fatG: 5 };

const set = (id: string, weightKg: number | null, reps: number, done: boolean, kind?: "warmup") => ({
  id,
  reps,
  weightKg,
  rpe: 8,
  durationSeconds: null,
  isCompleted: done,
  planned: { reps: 8, weightKg: 60, rpe: 8, durationSeconds: null },
  ...(kind === undefined ? {} : { kind }),
});
const squat = (sets: unknown[]) => ({ id: "x1", exerciseId: "cat-agachamento", name: "Agachamento", sets, restSeconds: 120, notes: "" });

describe("acompanhamento pela composição", () => {
  let t: TestDb;
  let rafael: string;
  let linkId: string;
  const repo = () => createFollowUpRepository(clientAs(t, rafael));
  const lunch: Meal = { id: "pm1", name: "Almoço", time: "12:30", notes: "", items: [createMealItem({ foodId: "arroz", name: "Arroz", grams: 100, per100g: PER_100G })] };
  const dinner: Meal = { id: "pm2", name: "Jantar", time: "20:00", notes: "", items: [createMealItem({ foodId: "peixe", name: "Peixe", grams: 100, per100g: PER_100G })] };

  beforeAll(async () => {
    t = await createTestDb();
    const admin = await t.createUser("lacallepm@gmail.com");
    await t.db.query("insert into public.app_admins (user_id) values ($1)", [admin]);
    rafael = await t.createUser("rafael@exemplo.com");
    await t.as(rafael, (tx) => tx.query("select public.request_professional_access('Rafael', null, null, '012345-G', 'SP')"));
    await t.as(admin, (tx) => tx.query("select public.admin_review_professional($1, 'approve', null)", [rafael]));
    const ana = await t.createUser("ana@exemplo.com");
    const invite = await t.as(rafael, (tx) => tx.query<{ token: string }>("select token from public.create_invite('Ana')"));
    const accepted = await t.as(ana, (tx) =>
      tx.query<{ accept_invite: string }>("select public.accept_invite($1, true, false, false, true)", [invite.rows[0]!.token]),
    );
    linkId = accepted.rows[0]!.accept_invite;

    const session = (id: string, at: number, exercises: unknown[]) =>
      t.db.query(
        `insert into public.workout_sessions (id, user_id, routine_id, name, started_at, finished_at, payload, client_updated_at)
         values ($1, $2, null, 'Treino A', $3, $4, $5, $3)`,
        [id, ana, at, at + 3_000_000, JSON.stringify({ exercises })],
      );
    await session("00000000-0000-4000-8000-000000000001", NOW - 3 * DAY, [squat([set("a", 60, 8, true), set("b", 60, 8, true)])]);
    await session("00000000-0000-4000-8000-000000000002", NOW - DAY, [
      squat([set("w", 100, 5, true, "warmup"), set("c", 62.5, 8, true), set("d", 62.5, 8, true), set("e", 62.5, 8, false)]),
    ]);
    await session("00000000-0000-4000-8000-000000000003", NOW - 2 * DAY, [{ quebrado: true }]);

    // O dia seguiu o plano: almoço feito como planejado, jantar com a quantidade mudada.
    const day = (planned: Meal, grams: number) => ({
      ...planned,
      id: `log-${planned.id}`,
      sourceDietId: "plano-1",
      sourceMealId: planned.id,
      plannedSnapshot: planned.items,
      items: planned.items.map((item) => ({ ...item, grams })),
      deletedAt: null,
    });
    await t.db.query(
      `insert into public.food_logs (user_id, day, payload, client_updated_at) values
       ($1, '2026-10-01', $2, 1), ($1, '2026-09-30', $3, 1)`,
      [
        ana,
        JSON.stringify({ meals: [day(lunch, 100), day(dinner, 150)], dietId: "plano-1" }),
        JSON.stringify({ meals: [], dietId: "dieta-dela" }),
      ],
    );
  });

  it("treinos: contas do app, carga comparada com o treino anterior, e o ilegível pulado", async () => {
    const sessions = await repo().listSessions(linkId, NOW - 30 * DAY);
    if (sessions === NOT_SHARED) throw new Error("devia liberar");
    expect(sessions.map((session) => session.id)).toEqual(["00000000-0000-4000-8000-000000000002", "00000000-0000-4000-8000-000000000001"]);
    const [latest, first] = sessions;
    expect(latest).toMatchObject({ setsDone: 3, setsTotal: 4, volumeKg: 1000, durationMs: 3_000_000 });
    expect(latest!.exercises[0]!.deltaKg, "o aquecimento de 100 kg contou como a maior carga").toBe(2.5);
    expect(latest!.exercises[0]!.sets.map((s) => s.done?.weightKg ?? null)).toEqual([100, 62.5, 62.5, null]);
    expect(latest!.exercises[0]!.sets[0]!.warmup).toBe(true);
    expect(latest!.exercises[0]!.sets[1]!.planned).toEqual({ weightKg: 60, reps: 8, durationSeconds: null });
    expect(first!.exercises[0]!.deltaKg, "sem treino anterior não há comparação").toBeNull();
  });

  it("diário: feito como planejado, feito com mudança, e o dia da dieta dela", async () => {
    const week = await repo().listDiary(linkId, "2026-09-28", "2026-10-04", { id: "plano-1", meals: [lunch, dinner] });
    if (week === NOT_SHARED) throw new Error("devia liberar");
    expect(week.planMeals).toEqual([{ id: "pm1", name: "Almoço" }, { id: "pm2", name: "Jantar" }]);
    expect(week.days).toEqual([
      { day: "2026-09-30", ownDiet: true, meals: { pm1: "unchecked", pm2: "unchecked" }, eatenKcal: 0 },
      { day: "2026-10-01", ownDiet: false, meals: { pm1: "checked", pm2: "edited" }, eatenKcal: 500 },
    ]);
  });

  it("o que não é liberado volta como 'não libera'", async () => {
    expect(await repo().listBody(linkId)).toBe(NOT_SHARED);
    const [row] = await repo().overview(NOW - 7 * DAY);
    expect(row).toMatchObject({ linkId, weightNow: NOT_SHARED, weightMonthAgo: NOT_SHARED, lastDiaryDay: "2026-10-01" });
    expect(row!.sessions).toEqual([
      { routineId: null, startedAt: NOW - 3 * DAY },
      { routineId: null, startedAt: NOW - 2 * DAY },
      { routineId: null, startedAt: NOW - DAY },
    ]);
  });
});
