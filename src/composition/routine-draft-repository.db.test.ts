import { beforeAll, describe, expect, it } from "vitest";

import type { Routine, RoutineExercise } from "@/features/workouts/types/routine";
import { clientAs, createTestDb, type TestDb } from "@/test/supabase-db";

import { createRoutineDraftRepository } from "./routine-draft-repository";

/**
 * O editor de treino gravando o rascunho do treino prescrito (0038), contra o
 * banco de verdade: várias gravações seguidas terminam na mais nova, os dias
 * vão na mesma fila sem desfazer a edição, e sem rascunho abre da última
 * versão publicada.
 */
const exercise = (id: string, name: string): RoutineExercise => ({
  id,
  exerciseId: "agachamento-livre-com-barra",
  name,
  sets: [{ id: `${id}-s1`, reps: 8, weightKg: 60, rpe: 8, durationSeconds: null }],
  restSeconds: 120,
  notes: "",
});

describe("rascunho do treino pelo editor de treino", () => {
  let t: TestDb;
  let rafael: string;
  let ana: string;
  let linkId: string;
  let routineId: string;

  beforeAll(async () => {
    t = await createTestDb();
    const admin = await t.createUser("lacallepm@gmail.com");
    await t.db.query("insert into public.app_admins (user_id) values ($1)", [admin]);
    rafael = await t.createUser("rafael@exemplo.com");
    await t.as(rafael, (tx) =>
      tx.query("select public.request_professional_access('Rafael Moura', null, null, '012345-G', 'SP')"),
    );
    await t.as(admin, (tx) => tx.query("select public.admin_review_professional($1, 'approve', null)", [rafael]));
    ana = await t.createUser("ana@exemplo.com");
    const invite = await t.as(rafael, (tx) => tx.query<{ token: string }>("select token from public.create_invite('Ana')"));
    const accepted = await t.as(ana, (tx) =>
      tx.query<{ accept_invite: string }>("select public.accept_invite($1, true, true, true)", [invite.rows[0]!.token]),
    );
    linkId = accepted.rows[0]!.accept_invite;
    const created = await t.as(rafael, (tx) =>
      tx.query<{ save_routine_draft: string }>("select public.save_routine_draft(null, $1, 'Treino A', '', '[]')", [linkId]),
    );
    routineId = created.rows[0]!.save_routine_draft;
  });

  it("abre o rascunho, grava em fila e termina na versão mais nova; os dias vão junto, sem desfazer nada", async () => {
    const repo = createRoutineDraftRepository(clientAs(t, rafael), { routineId, linkId });
    const opened = (await repo.getById(routineId))!;
    expect(opened).toMatchObject({ id: routineId, name: "Treino A", exercises: [] });
    expect(await repo.weekdays(), "sem escolha, nenhum dia").toEqual([]);

    const edits: Routine[] = ["Agacho", "Agachamento", "Agachamento livre"].map((name, index) => ({
      ...opened,
      exercises: [exercise("e1", name)],
      updatedAt: opened.updatedAt + index + 1,
    }));
    const saves = edits.map((routine) => repo.save(routine, null));
    // Os dias no meio das edições: na mesma fila, levam a rotina mais nova.
    const days = repo.setWeekdays(["thu", "tue"]);
    await Promise.all([...saves, days]);

    const fresh = createRoutineDraftRepository(clientAs(t, rafael), { routineId, linkId });
    expect((await fresh.getById(routineId))!.exercises.map((item) => item.name)).toEqual(["Agachamento livre"]);
    expect(await fresh.weekdays(), "na ordem da semana").toEqual(["tue", "thu"]);
  });

  it("o paciente não lê o rascunho, nem por este repositório", async () => {
    const repo = createRoutineDraftRepository(clientAs(t, ana), { routineId, linkId });
    expect(await repo.getById(routineId)).toBeUndefined();
  });

  it("sem rascunho, abre da última versão publicada, com os dias dela", async () => {
    await t.as(rafael, (tx) => tx.query("select public.publish_routine($1, '')", [routineId]));
    const repo = createRoutineDraftRepository(clientAs(t, rafael), { routineId, linkId });
    expect((await repo.getById(routineId))!.exercises.map((item) => item.name)).toEqual(["Agachamento livre"]);
    expect(await repo.weekdays()).toEqual(["tue", "thu"]);
  });
});
