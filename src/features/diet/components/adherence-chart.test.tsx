import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import type { AdherencePoint } from "../services/diet-adherence";
import { AdherenceChart } from "./adherence-chart";

const points: readonly AdherencePoint[] = [
  { startsAt: 3, checkedMeals: 4, plannedMeals: 8, daysWithPlan: 4 },
  { startsAt: 2, checkedMeals: 0, plannedMeals: 0, daysWithPlan: 0 },
  { startsAt: 1, checkedMeals: 6, plannedMeals: 6, daysWithPlan: 3 },
];

const format = (point: AdherencePoint) => `semana ${String(point.startsAt)}`;

describe("AdherenceChart", () => {
  it("shows the most recent point's fraction as real text", () => {
    // `points` arrives most-recent-first, same convention `VolumeChart` uses
    // — index 0 (startsAt: 3) is what the summary defaults to.
    render(<AdherenceChart points={points} format={format} />);

    const summary = screen.getByText("4 de 8").closest("p")!;
    expect(within(summary).getByText(/semana 3/)).toBeInTheDocument();
  });

  it("switches the summary when a different bar is pressed", async () => {
    render(<AdherenceChart points={points} format={format} />);

    await userEvent.click(
      screen.getByRole("button", { name: /semana 1.*6 de 6/ }),
    );

    expect(screen.getByText("6 de 6")).toBeInTheDocument();
  });

  it("reads a week with no diet scheduled as its own state, not 0%", () => {
    render(<AdherenceChart points={points} format={format} />);

    expect(
      screen.getByRole("button", { name: "semana 2: nenhuma dieta vinculada" }),
    ).toBeInTheDocument();
  });

  it("uses the singular for exactly one planned meal", () => {
    const single: readonly AdherencePoint[] = [
      { startsAt: 1, checkedMeals: 1, plannedMeals: 1, daysWithPlan: 1 },
    ];

    render(<AdherenceChart points={single} format={format} />);

    expect(screen.getByText(/refeição planejada\b/)).toBeInTheDocument();
    expect(screen.queryByText(/refeições planejadas/)).not.toBeInTheDocument();
  });

  it("renders nothing when there are no points, instead of crashing", () => {
    const { container } = render(<AdherenceChart points={[]} format={format} />);

    expect(container.querySelectorAll("button")).toHaveLength(0);
  });
});
