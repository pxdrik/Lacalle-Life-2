import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MacroDonut } from "./macro-donut";

/** 25/50/25 (protein/carbs/fat) — as kcal weights, the shape any real
 * caller passes (50 g protein at 4 kcal/g is 200 kcal, 100 g carbs at
 * 4 kcal/g is 400 kcal, ~22,22 g fat at 9 kcal/g is the last 200 kcal of an
 * 800 kcal total), but `MacroDonut` itself only ever sees the three
 * numbers below — it has no opinion on what unit they are in. */
const SHARES = { proteinG: 200, carbsG: 400, fatG: 200 };

describe("MacroDonut", () => {
  it("draws one arc per macro that actually has a share", () => {
    const { container } = render(<MacroDonut shares={SHARES} />);

    // The track plus three coloured arcs.
    expect(container.querySelectorAll("circle")).toHaveLength(4);
  });

  it("labels each arc with its rounded percentage", () => {
    const { container } = render(<MacroDonut shares={SHARES} />);
    const labels = Array.from(container.querySelectorAll("text")).map(
      (node) => node.textContent,
    );

    expect(labels).toEqual(["25%", "50%", "25%"]);
  });

  it("skips a slice too thin to hold a number", () => {
    // Protein at ~2% of the total — a real label there would print on top
    // of the next slice.
    const { container } = render(
      <MacroDonut shares={{ proteinG: 20, carbsG: 800, fatG: 198 }} />,
    );

    expect(container.querySelectorAll("text")).toHaveLength(2);
  });

  it("never divides by zero when every share is 0", () => {
    expect(() =>
      render(<MacroDonut shares={{ proteinG: 0, carbsG: 0, fatG: 0 }} />),
    ).not.toThrow();
  });

  it("omits labels entirely when asked, for a preview too small to hold text", () => {
    const { container } = render(
      <MacroDonut shares={SHARES} size={32} showLabels={false} />,
    );

    expect(container.querySelectorAll("text")).toHaveLength(0);
  });
});
