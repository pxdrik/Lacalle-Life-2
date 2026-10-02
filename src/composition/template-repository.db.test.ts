import { beforeAll, describe, expect, it } from "vitest";

import { createMealItem } from "@/features/diet/services/create-diet";
import type { Meal } from "@/features/diet/types/diet";
import { clientAs, createTestDb, type TestDb } from "@/test/supabase-db";

import { createTemplateDraftDietRepository } from "./plan-draft-repository";
import { createRoutineTemplateDraftRepository, createTemplateRepository } from "./template-repository";

/**
 * A Biblioteca (Etapa 5d) contra o banco de verdade (0035): o modelo é
 * editado pelo editor de dieta, a lista soma refeições e kcal, e usar num
 * paciente cria um plano em rascunho com uma cópia, que não muda quando o
 * modelo muda. Outra profissional não vê nem apaga.
 */
const PER_100G = { kcal: 200, proteinG: 10, carbsG: 20, fatG: 5 };
const breakfast: Meal = {
  id: "m1",
  name: "Café da manhã",
  time: "07:30",
  notes: "Pode trocar a aveia por granola.",
  items: [{ ...createMealItem({ foodId: "aveia", name: "Aveia", grams: 50, per100g: PER_100G }), id: "i1" }],
};
const none = () => Promise.resolve();

describe("Biblioteca de modelos", () => {
  let t: TestDb;
  let marina: string;
  let paulo: string;
  let linkId: string;

  async function professional(email: string, name: string, admin: string): Promise<string> {
    const uid = await t.createUser(email);
    await t.as(uid, (tx) => tx.query("select public.request_professional_access($1, 'CRN-3', '1', null, null)", [name]));
    await t.as(admin, (tx) => tx.query("select public.admin_review_professional($1, 'approve', null)", [uid]));
    return uid;
  }

  beforeAll(async () => {
    t = await createTestDb();
    const admin = await t.createUser("lacallepm@gmail.com");
    await t.db.query("insert into public.app_admins (user_id) values ($1)", [admin]);
    marina = await professional("marina@exemplo.com", "Marina Faria", admin);
    paulo = await professional("paulo@exemplo.com", "Paulo Dias", admin);
    const ana = await t.createUser("ana@exemplo.com");
    const invite = await t.as(marina, (tx) => tx.query<{ token: string }>("select token from public.create_invite('Ana')"));
    const accepted = await t.as(ana, (tx) =>
      tx.query<{ accept_invite: string }>("select public.accept_invite($1, true, true, true)", [invite.rows[0]!.token]),
    );
    linkId = accepted.rows[0]!.accept_invite;
  });

  it("cria vazio, edita pelo editor de dieta, e a lista mostra refeições e kcal", async () => {
    const library = createTemplateRepository(clientAs(t, marina), none);
    const id = await library.createTemplate("Déficit moderado");
    expect(await library.listTemplates()).toMatchObject([{ id, name: "Déficit moderado", mealCount: 0, kcal: 0 }]);

    const editor = createTemplateDraftDietRepository(clientAs(t, marina), id);
    const opened = (await editor.getById(id))!;
    expect(opened).toMatchObject({ id, name: "Déficit moderado", meals: [], weekdays: [] });
    await editor.save({ ...opened, name: "Déficit leve", meals: [breakfast], updatedAt: opened.updatedAt + 1 }, null);

    expect(await library.listTemplates()).toMatchObject([{ id, name: "Déficit leve", mealCount: 1, kcal: 100 }]);
  });

  it("usar num paciente cria um plano em rascunho com cópia de ids novos, e mudar o modelo não mexe nele", async () => {
    const library = createTemplateRepository(clientAs(t, marina), none);
    const [template] = await library.listTemplates();
    const planId = await library.applyToPatient(template!.id, linkId);

    const draft = await t.as(marina, (tx) =>
      tx.query<{ name: string; meals: Meal[]; weekdays: string[] }>(
        "select name, meals, weekdays from public.prescribed_plan_drafts where plan_id = $1",
        [planId],
      ),
    );
    const [plan] = draft.rows;
    expect(plan).toMatchObject({ name: "Déficit leve", weekdays: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] });
    expect(plan!.meals).toMatchObject([{ name: "Café da manhã", notes: breakfast.notes, items: [{ name: "Aveia", grams: 50 }] }]);
    expect(plan!.meals[0]!.id, "o plano divide o id da refeição com o modelo").not.toBe("m1");
    expect(plan!.meals[0]!.items[0]!.id, "o plano divide o id do alimento com o modelo").not.toBe("i1");

    const editor = createTemplateDraftDietRepository(clientAs(t, marina), template!.id);
    const opened = (await editor.getById(template!.id))!;
    await editor.save({ ...opened, meals: [], updatedAt: opened.updatedAt + 1 }, null);
    const after = await t.as(marina, (tx) =>
      tx.query<{ meals: Meal[] }>("select meals from public.prescribed_plan_drafts where plan_id = $1", [planId]),
    );
    expect(after.rows[0]!.meals, "mudar o modelo mexeu no plano").toHaveLength(1);
  });

  it("a lista espera as gravações do editor ainda a caminho antes de ler", async () => {
    // No banco de teste a gravação chega rápido demais para a corrida
    // aparecer sozinha (visto: o teste passava sem a espera), então a
    // espera é segurada à mão.
    let release!: () => void;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    let listed = false;
    const listing = createTemplateRepository(clientAs(t, marina), () => pending)
      .listTemplates()
      .then(() => {
        listed = true;
      });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(listed, "a lista leu sem esperar a gravação").toBe(false);
    release();
    await listing;
    expect(listed).toBe(true);
  });

  it("outra profissional não lista, não usa e não apaga; a dona apaga", async () => {
    const mine = createTemplateRepository(clientAs(t, marina), none);
    const [template] = await mine.listTemplates();
    const other = createTemplateRepository(clientAs(t, paulo), none);
    expect(await other.listTemplates()).toEqual([]);
    await expect(other.applyToPatient(template!.id, linkId)).rejects.toThrow(/not found/);
    await expect(other.deleteTemplate(template!.id)).rejects.toThrow(/not found/);

    await mine.deleteTemplate(template!.id);
    expect(await mine.listTemplates()).toEqual([]);
  });

  it("modelo de treino: edita pelo editor de treino, lista exercícios e séries, e usar vira um treino sem dias com cópia", async () => {
    const library = createTemplateRepository(clientAs(t, marina), none);
    const id = await library.createRoutineTemplate("Treino A");
    expect(await library.listRoutineTemplates()).toMatchObject([{ id, name: "Treino A", exerciseCount: 0, setCount: 0 }]);

    const editor = createRoutineTemplateDraftRepository(clientAs(t, marina), id);
    const opened = (await editor.getById(id))!;
    const squat = {
      id: "x1",
      exerciseId: "cat-agachamento",
      name: "Agachamento",
      sets: [1, 2, 3].map((n) => ({ id: `s${String(n)}`, reps: 8, weightKg: 60, rpe: 8, durationSeconds: null })),
      restSeconds: 120,
      notes: "Desça até a coxa ficar paralela.",
    };
    await editor.save({ ...opened, name: "Treino A, inferiores", exercises: [squat], updatedAt: opened.updatedAt + 1 });
    expect(await library.listRoutineTemplates()).toMatchObject([{ id, name: "Treino A, inferiores", exerciseCount: 1, setCount: 3 }]);

    const routineId = await library.applyRoutineToPatient(id, linkId);
    const draft = await t.as(marina, (tx) =>
      tx.query<{ name: string; exercises: { id: string; exerciseId: string; sets: { id: string }[] }[]; weekdays: string[] }>(
        "select name, exercises, weekdays from public.prescribed_routine_drafts where routine_id = $1",
        [routineId],
      ),
    );
    const [routine] = draft.rows;
    expect(routine).toMatchObject({ name: "Treino A, inferiores", weekdays: [] });
    expect(routine!.exercises[0]).toMatchObject({ exerciseId: "cat-agachamento" });
    expect(routine!.exercises[0]!.id, "o treino divide o id do exercício com o modelo").not.toBe("x1");
    expect(routine!.exercises[0]!.sets[0]!.id, "o treino divide o id da série com o modelo").not.toBe("s1");

    const other = createTemplateRepository(clientAs(t, paulo), none);
    expect(await other.listRoutineTemplates()).toEqual([]);
    await expect(other.applyRoutineToPatient(id, linkId)).rejects.toThrow(/not found/);
    await expect(other.deleteRoutineTemplate(id)).rejects.toThrow(/not found/);
    await library.deleteRoutineTemplate(id);
    expect(await library.listRoutineTemplates()).toEqual([]);
  });
});
