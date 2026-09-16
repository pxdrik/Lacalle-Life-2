import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MealMacroBar } from "./meal-macro-bar";

describe("MealMacroBar", () => {
  it("mostra o total de kcal arredondado", () => {
    render(
      <MealMacroBar
        macros={{ kcal: 421.6, proteinG: 30, carbsG: 40, fatG: 10 }}
      />,
    );

    expect(screen.getByText("422")).toBeInTheDocument();
  });

  it("anuncia os três macros em gramas para quem não vê a barra", () => {
    render(
      <MealMacroBar
        macros={{ kcal: 200, proteinG: 20, carbsG: 10, fatG: 5 }}
      />,
    );

    expect(
      screen.getByRole("img", { name: "Prot 20g, Carb 10g, Gord 5g" }),
    ).toBeInTheDocument();
  });

  it("não quebra numa refeição vazia", () => {
    render(
      <MealMacroBar macros={{ kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 }} />,
    );

    expect(screen.getByText("0")).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "Prot 0g, Carb 0g, Gord 0g" }),
    ).toBeInTheDocument();
  });
});
