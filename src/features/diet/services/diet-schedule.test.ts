import { describe, expect, it } from "vitest";

import { createDiet } from "./create-diet";
import {
  assignWeekdays,
  dietForWeekday,
  weekdayOf,
} from "./diet-schedule";
import type { Diet } from "../types/diet";

function withWeekdays(diet: Diet, weekdays: Diet["weekdays"]): Diet {
  return { ...diet, weekdays };
}

describe("weekdayOf", () => {
  it.each([
    [new Date(2026, 7, 17), "mon"], // 17/08/2026 é segunda
    [new Date(2026, 7, 18), "tue"],
    [new Date(2026, 7, 22), "sat"],
    [new Date(2026, 7, 23), "sun"],
  ] as const)("reads %s as %s, Monday-first", (date, expected) => {
    expect(weekdayOf(date)).toBe(expected);
  });
});

describe("assignWeekdays", () => {
  it("links the given weekdays to the diet", () => {
    const diet = createDiet("Treino");
    const next = assignWeekdays([diet], diet.id, ["mon", "wed", "fri"]);

    expect(next[0]?.weekdays).toEqual(["mon", "wed", "fri"]);
  });

  it("steals a weekday from whichever diet held it before", () => {
    // Um dia é um slot de calendário, não uma etiqueta — só pode apontar
    // para uma dieta de cada vez.
    const treino = withWeekdays(createDiet("Treino"), ["mon", "wed"]);
    const descanso = withWeekdays(createDiet("Descanso"), ["tue"]);

    const next = assignWeekdays([treino, descanso], descanso.id, ["mon"]);

    const nextTreino = next.find((d) => d.id === treino.id);
    const nextDescanso = next.find((d) => d.id === descanso.id);

    expect(nextTreino?.weekdays).toEqual(["wed"]);
    expect(nextDescanso?.weekdays).toEqual(["mon"]);
  });

  it("returns the exact same diet reference when nothing changed", () => {
    const treino = withWeekdays(createDiet("Treino"), ["mon"]);
    const outra = createDiet("Outra");

    const next = assignWeekdays([treino, outra], treino.id, ["mon"]);

    expect(next[0]).toBe(treino);
    expect(next[1]).toBe(outra);
  });

  it("only revises diets whose weekdays actually moved", () => {
    const treino = withWeekdays(createDiet("Treino"), ["mon"]);
    const outra = createDiet("Outra");

    const next = assignWeekdays([treino, outra], treino.id, ["mon", "tue"]);

    expect(next[0]).not.toBe(treino);
    expect(next[0]?.weekdays).toEqual(["mon", "tue"]);
    // `outra` never held any of the affected weekdays, so it is untouched —
    // not even a bumped `updatedAt`.
    expect(next[1]).toBe(outra);
  });

  it("clears every weekday when given an empty list", () => {
    const treino = withWeekdays(createDiet("Treino"), ["mon", "tue"]);

    const next = assignWeekdays([treino], treino.id, []);

    expect(next[0]?.weekdays).toEqual([]);
  });
});

describe("dietForWeekday", () => {
  it("finds the diet linked to a weekday", () => {
    const treino = withWeekdays(createDiet("Treino"), ["mon"]);
    const descanso = withWeekdays(createDiet("Descanso"), ["sun"]);

    expect(dietForWeekday([treino, descanso], "mon")).toBe(treino);
    expect(dietForWeekday([treino, descanso], "sun")).toBe(descanso);
  });

  it("returns undefined when no diet claims that weekday", () => {
    const treino = withWeekdays(createDiet("Treino"), ["mon"]);

    expect(dietForWeekday([treino], "fri")).toBeUndefined();
  });
});
