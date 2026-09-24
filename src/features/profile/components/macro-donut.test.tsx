import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MacroDonut } from "./macro-donut";

/** kcal split 25/50/25 (protein/carbs/fat) by construction: 50 g protein
 * (4 kcal/g) is 200 kcal, 100 g carbs (4 kcal/g) is 400 kcal, and 22,22 g
 * fat (9 kcal/g) fills the last 200 kcal of an 800 kcal total — chosen for
 * round percentages, not for being a realistic target. */
const MACROS = { kcal: 800, proteinG: 50, carbsG: 100, fatG: 22.22 };

describe("MacroDonut", () => {
  it("draws one arc per macro that actually has a share", () => {
    const { container } = render(<MacroDonut macros={MACROS} />);

    // The track plus three coloured arcs.
    expect(container.querySelectorAll("circle")).toHaveLength(4);
  });

  it("labels each arc with its rounded percentage", () => {
    const { container } = render(<MacroDonut macros={MACROS} />);
    const labels = Array.from(container.querySelectorAll("text")).map(
      (node) => node.textContent,
    );

    expect(labels).toEqual(["25%", "50%", "25%"]);
  });

  it("skips a slice too thin to hold a number", () => {
    // Protein at ~2% of kcal — a real label there would print on top of the
    // next slice.
    const { container } = render(
      <MacroDonut macros={{ kcal: 1000, proteinG: 5, carbsG: 200, fatG: 22 }} />,
    );

    expect(container.querySelectorAll("text")).toHaveLength(2);
  });

  it("never divides by zero when every macro is 0", () => {
    expect(() =>
      render(<MacroDonut macros={{ kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 }} />),
    ).not.toThrow();
  });
});
