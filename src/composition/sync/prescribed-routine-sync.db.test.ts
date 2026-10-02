import { beforeAll, describe, expect, it } from "vitest";

import { MemoryStore } from "@/core/storage/memory-store";
import { createRoutineDraftRepository } from "@/composition/routine-draft-repository";
import { createSupabaseCareRepository } from "@/features/pro/data/supabase-care-repository";
import { createSupabaseProRepository } from "@/features/pro/data/supabase-pro-repository";
import { createSupabaseRoutineRepository } from "@/features/pro/data/supabase-routine-repository";
import {
  LocalPrescribedRoutineRepository,
  PRESCRIBED_ROUTINES_STORE,
} from "@/features/workouts/data/prescribed-routine-repository";
import type { PrescribedRoutine } from "@/features/workouts/types/prescribed-routine";
import type { RoutineExercise } from "@/features/workouts/types/routine";
import { clientAs, createTestDb, type TestDb } from "@/test/supabase-db";

import { pullPrescribedRoutines } from "./prescribed-routine-sync";
import type { SyncSupabaseClient } from "./sync-supabase-client";

/**
 * O treino descendo para o aparelho do paciente, contra o banco de verdade
 * (0038). Como no plano: o rascunho nunca desce, outro paciente não recebe, e
 * o treinador que também usa o app não puxa os treinos que montou.
 */
const exercise = (name: string): RoutineExercise => ({
  id: `e-${name}`,
  exerciseId: `cat-${name}`,
  name,
  sets: [{ id: `s-${name}`, reps: 8, weightKg: 60, rpe: 8, durationSeconds: null }],
  restSeconds: 90,
  notes: "",
});

describe("treinos recebidos pela sincronização", () => {
  let t: TestDb;
  let rafael: string;
  let ana: string;
  let linkId: string;
  let routineId: string;

  const local = () =>
    new LocalPrescribedRoutineRepository(new MemoryStore<PrescribedRoutine>(PRESCRIBED_ROUTINES_STORE));
  const sync = (uid: string) => clientAs(t, uid) as unknown as SyncSupabaseClient;
  const draft = () => createRoutineDraftRepository(clientAs(t, rafael), { routineId, linkId });
  const publish = (note: string) => createSupabaseRoutineRepository(clientAs(t, rafael)).publish(routineId, note);

  async function saveDraft(exercises: RoutineExercise[]) {
    const routine = (await draft().getById(routineId))!;
    await draft().save({ ...routine, exercises }, routine.updatedAt);
  }

  beforeAll(async () => {
    t = await createTestDb();
    const admin = await t.createUser("lacallepm@gmail.com");
    await t.db.query("insert into public.app_admins (user_id) values ($1)", [admin]);
    rafael = await t.createUser("rafael@exemplo.com");
    await createSupabaseProRepository(clientAs(t, rafael)).requestAccess({
      displayName: "Rafael Moura",
      registrations: { crn: null, cref: { number: "012345-G", region: "SP" } },
    });
    await createSupabaseProRepository(clientAs(t, admin)).approve(rafael);
    ana = await t.createUser("ana@exemplo.com");
    const { token } = await createSupabaseCareRepository(clientAs(t, rafael)).createInvite("Ana");
    await createSupabaseCareRepository(clientAs(t, ana)).acceptInvite(token, { diary: true, workouts: true, body: true, profile: true });
    [{ id: linkId }] = await createSupabaseCareRepository(clientAs(t, rafael))
      .listMyPatients()
      .then((r) => r.links);
    routineId = await createSupabaseRoutineRepository(clientAs(t, rafael)).createRoutine(linkId, "Treino A");
  });

  it("o rascunho não desce: sem versão publicada, o paciente não recebe nada", async () => {
    const repo = local();
    expect(await pullPrescribedRoutines(sync(ana), repo)).toEqual({ status: "done" });
    expect(await repo.listAll()).toEqual([]);
  });

  it("a versão publicada desce com a anterior, o nome do treinador e o que o paciente já viu", async () => {
    await saveDraft([exercise("Agachamento")]);
    await publish("Primeiro treino");
    const repo = local();
    await pullPrescribedRoutines(sync(ana), repo);
    await repo.markSeen(routineId, 1);

    await saveDraft([exercise("Agachamento"), exercise("Leg press")]);
    await draft().setWeekdays(["mon", "thu"]);
    await publish("Leg press novo");
    await pullPrescribedRoutines(sync(ana), repo);

    const [routine] = await repo.listAll();
    expect(routine).toMatchObject({
      id: routineId,
      name: "Treino A",
      professionalName: "Rafael Moura",
      version: 2,
      changeNote: "Leg press novo",
      linkEnded: false,
      seenVersion: 1,
      weekdays: ["mon", "thu"],
      // Sem escolha do treinador, nenhum dia: o paciente faz quando quiser.
      previous: { version: 1, weekdays: [] },
    });
    expect(routine!.exercises.map((item) => item.name)).toEqual(["Agachamento", "Leg press"]);
    expect(routine!.previous!.exercises.map((item) => item.name)).toEqual(["Agachamento"]);
  });

  it("outro paciente não recebe, e o treinador não puxa o treino que montou", async () => {
    const outro = await t.createUser("outro@exemplo.com");
    for (const uid of [outro, rafael]) {
      const repo = local();
      await pullPrescribedRoutines(sync(uid), repo);
      expect(await repo.listAll(), uid === rafael ? "o treinador puxou o treino do paciente" : "outro paciente recebeu").toEqual([]);
    }
  });
});
