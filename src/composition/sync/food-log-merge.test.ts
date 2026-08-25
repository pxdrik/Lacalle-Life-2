import { describe, expect, it } from "vitest";

import type { Meal } from "@/features/diet/types/diet";

import { mergeFoodLogMeals, type WireMeal } from "./food-log-merge";

/**
 * As 5 propriedades pedidas pelo Pedro antes de aprovar o motor de sync do
 * `FoodLog` — testadas direto contra o algoritmo puro, sem rede nem
 * IndexedDB, porque é aqui que a regra de merge (§19.5) realmente vive.
 */

function meal(id: string, overrides: Partial<Meal> = {}): Meal {
  return {
    id,
    name: overrides.name ?? id,
    time: overrides.time ?? null,
    notes: overrides.notes ?? "",
    items: overrides.items ?? [],
  };
}

function wire(m: Meal, deletedAt: string | null = null): WireMeal {
  return { ...m, deletedAt };
}

describe("mergeFoodLogMeals", () => {
  it("1. merge sem conflito: A cria meal-A, B cria meal-B — resultado tem os dois, sem duplicar", () => {
    const mealA = meal("meal-A", { name: "Café" });
    const mealB = meal("meal-B", { name: "Almoço" });

    // Do ponto de vista de A: local = [A], remote (o que B já publicou) = [B].
    const result = mergeFoodLogMeals([mealA], [wire(mealB)], null);

    expect(result.conflicts).toHaveLength(0);
    expect(result.liveMeals.map((m) => m.id).sort()).toEqual(["meal-A", "meal-B"]);
    // Idempotência do próprio cenário: rodar o merge nos dois sentidos
    // (do ponto de vista de B) chega ao mesmo conjunto.
    const fromB = mergeFoodLogMeals([mealB], [wire(mealA)], null);
    expect(fromB.liveMeals.map((m) => m.id).sort()).toEqual(["meal-A", "meal-B"]);
  });

  it("2. mesmo Meal.id alterado nos dois dispositivos vira conflito visível — nunca inventa merge de campo", () => {
    const base = meal("meal-A", { name: "Almoço", items: [] });
    const localEdit = meal("meal-A", { name: "Almoço", items: [{ id: "i1", foodId: null, name: "Arroz 500kcal", grams: 200, unit: "g", per100g: { kcal: 250, proteinG: 5, carbsG: 50, fatG: 1 } }] });
    const remoteEdit = meal("meal-A", { name: "Almoço", items: [{ id: "i2", foodId: null, name: "Frango 700kcal", grams: 300, unit: "g", per100g: { kcal: 233, proteinG: 30, carbsG: 0, fatG: 12 } }] });

    const result = mergeFoodLogMeals(
      [localEdit],
      [wire(remoteEdit)],
      [wire(base)],
    );

    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0]).toMatchObject({
      mealId: "meal-A",
      local: { name: "Almoço" },
      remote: { name: "Almoço" },
    });
    // Nenhum lado "ganha" sozinho: o resultado ao vivo continua com o local
    // até uma resolução explícita, nunca o remoto aplicado por baixo.
    expect(result.liveMeals[0]?.items[0]?.name).toBe("Arroz 500kcal");
  });

  it("3. exclusão concorrente: A remove meal-A, B só editou outra coisa — tombstone não é ressuscitado pelo pull de B", () => {
    const mealA = meal("meal-A", { name: "Lanche" });
    const base = [wire(mealA)];

    // A apagou meal-A localmente (sumiu do array). B nunca tocou meal-A —
    // o remoto (o que B publicou) ainda mostra meal-A exatamente como era.
    const result = mergeFoodLogMeals([], [wire(mealA)], base);

    expect(result.conflicts).toHaveLength(0);
    expect(result.liveMeals).toHaveLength(0);
    expect(result.wireMeals.find((m) => m.id === "meal-A")?.deletedAt).not.toBeNull();
  });

  it("3b. exclusão concorrente com edição real do outro lado vira conflito, não sobrescreve a exclusão nem a edição", () => {
    const mealA = meal("meal-A", { name: "Lanche" });
    const base = [wire(mealA)];
    const editedByB = meal("meal-A", { name: "Lanche da tarde" });

    // A apagou meal-A. B editou o nome de meal-A (mudança real desde a base).
    const result = mergeFoodLogMeals([], [wire(editedByB)], base);

    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0]?.mealId).toBe("meal-A");
  });

  it("4. offline + retry não duplica: mesmo merge repetido com o mesmo local/remote/base é idempotente", () => {
    const mealA = meal("meal-A", { name: "Café" });

    // Primeira vez: cria localmente, nunca sincronizou (lastSynced null).
    const firstPush = mergeFoodLogMeals([mealA], [], null);
    expect(firstPush.liveMeals).toHaveLength(1);
    expect(firstPush.conflicts).toHaveLength(0);

    // "Fecha o app, reabre, internet volta": o outbox local ainda tem
    // meal-A, e agora o servidor já reflete o que foi enviado antes (mesmo
    // conteúdo) — reenviar não duplica nem gera conflito consigo mesmo.
    const retry = mergeFoodLogMeals([mealA], firstPush.wireMeals, firstPush.wireMeals);
    expect(retry.conflicts).toHaveLength(0);
    expect(retry.liveMeals).toHaveLength(1);
    expect(retry.liveMeals[0]?.id).toBe("meal-A");
  });

  it("5. ordem das refeições após a união é a mesma nos dois dispositivos, independente de quem sincronizou primeiro", () => {
    const breakfast = meal("m-breakfast", { name: "Café", time: "08:00" });
    const lunch = meal("m-lunch", { name: "Almoço", time: "12:00" });
    const dinner = meal("m-dinner", { name: "Jantar", time: "20:00" });

    // A: breakfast + lunch. B: breakfast + dinner.
    const fromA = mergeFoodLogMeals([breakfast, lunch], [wire(breakfast), wire(dinner)], null);
    const fromB = mergeFoodLogMeals([breakfast, dinner], [wire(breakfast), wire(lunch)], null);

    const orderA = fromA.liveMeals.map((m) => m.id);
    const orderB = fromB.liveMeals.map((m) => m.id);

    expect(orderA).toEqual(["m-breakfast", "m-lunch", "m-dinner"]);
    expect(orderB).toEqual(orderA);
  });

  it("desempata refeições com o mesmo horário (ou sem horário) por Meal.id, não por ordem de chegada", () => {
    const noTimeZ = meal("zzz", { name: "Sem horário Z" });
    const noTimeA = meal("aaa", { name: "Sem horário A" });

    const fromOneOrder = mergeFoodLogMeals([noTimeZ], [wire(noTimeA)], null);
    const fromOtherOrder = mergeFoodLogMeals([noTimeA], [wire(noTimeZ)], null);

    expect(fromOneOrder.liveMeals.map((m) => m.id)).toEqual(["aaa", "zzz"]);
    expect(fromOtherOrder.liveMeals.map((m) => m.id)).toEqual(["aaa", "zzz"]);
  });

  it("dois dispositivos apagando a mesma refeição não gera conflito", () => {
    const mealA = meal("meal-A", { name: "Lanche" });
    const base = [wire(mealA)];

    const result = mergeFoodLogMeals([], [wire(mealA, "2026-08-25T10:00:00Z")], base);

    expect(result.conflicts).toHaveLength(0);
    expect(result.liveMeals).toHaveLength(0);
  });
});

describe("mergeFoodLogMeals — tentando quebrar de propósito", () => {
  it("conflito numa refeição não contamina a união normal de outra refeição no mesmo merge", () => {
    const base = meal("meal-A", { name: "Almoço" });
    const localA = meal("meal-A", { name: "Almoço (editado local)" });
    const remoteA = meal("meal-A", { name: "Almoço (editado remoto)" });
    const localOnlyB = meal("meal-B", { name: "Lanche novo local" });
    const remoteOnlyC = meal("meal-C", { name: "Jantar novo remoto" });

    const result = mergeFoodLogMeals(
      [localA, localOnlyB],
      [wire(remoteA), wire(remoteOnlyC)],
      [wire(base)],
    );

    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0]?.mealId).toBe("meal-A");
    // B e C entraram normalmente, sem esperar a resolução de A.
    const liveIds = result.liveMeals.map((m) => m.id).sort();
    expect(liveIds).toEqual(["meal-A", "meal-B", "meal-C"]);
  });

  it("exclusão local depois de uma edição real local não é tratada como 'não mudou' — não faz o tombstone vencer escondido", () => {
    // A editou meal-A (mudança real), sincronizou (virou a nova base), e só
    // DEPOIS apagou. O merge não deve confundir isso com "nunca mudou".
    const base = meal("meal-A", { name: "Editado antes de apagar" });
    // B, nesse meio tempo, editou de novo a partir da MESMA base.
    const editedByB = meal("meal-A", { name: "Editado por B" });

    const result = mergeFoodLogMeals([], [wire(editedByB)], [wire(base)]);

    // B mudou de verdade em relação à base -> conflito, exclusão não vence
    // escondida.
    expect(result.conflicts).toHaveLength(1);
  });

  it("três dispositivos em sequência (A soube de B, depois soube de C) convergem sem duplicar nem perder nada", () => {
    const mealA = meal("meal-A");
    const mealB = meal("meal-B");
    const mealC = meal("meal-C");

    const afterB = mergeFoodLogMeals([mealA], [wire(mealB)], null);
    expect(afterB.liveMeals).toHaveLength(2);

    // Terceira sincronização: local já tem A+B (resultado anterior), remoto
    // agora também tem C.
    const afterC = mergeFoodLogMeals(
      afterB.liveMeals,
      [...afterB.wireMeals, wire(mealC)],
      afterB.wireMeals,
    );

    expect(afterC.conflicts).toHaveLength(0);
    expect(afterC.liveMeals.map((m) => m.id).sort()).toEqual(["meal-A", "meal-B", "meal-C"]);
  });

  it("apagar uma refeição que o outro lado NUNCA teve (id só local, sumiu) não vira tombstone fantasma no payload de fio", () => {
    // meal-X foi criado e apagado no mesmo dispositivo, sem nunca ter sido
    // sincronizado (lastSynced null) — não deveria existir rastro nenhum.
    const mealKept = meal("meal-kept");
    const result = mergeFoodLogMeals([mealKept], [], null);

    expect(result.wireMeals.find((m) => m.id === "meal-x")).toBeUndefined();
    expect(result.conflicts).toHaveLength(0);
  });
});
