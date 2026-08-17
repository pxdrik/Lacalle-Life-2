import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { weeklyRatePresets } from "@/core/nutrition";

import { ProfileForm } from "./profile-form";

/**
 * A.1 from the roadmap: fixed presets ("1 kg/semana") cannot work because the
 * safe ceiling is a percentage of bodyweight, asymmetric between cut and
 * bulk. These tests exist to catch a regression back to a fixed number.
 */
describe("weekly rate presets in the profile form", () => {
  it("offers presets scaled to the weight already typed in, for a cut", async () => {
    render(<ProfileForm initial={null} pending={false} onSubmit={vi.fn()} />);

    await userEvent.selectOptions(
      screen.getByLabelText("Objetivo"),
      "Perder gordura",
    );
    await userEvent.type(screen.getByLabelText("Peso (kg)"), "60");

    const [light, moderate] = weeklyRatePresets(60, "cut");

    expect(
      screen.getByRole("button", {
        name: `${light?.label} — 0,30 kg`,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: `${moderate?.label} — 0,60 kg`,
      }),
    ).toBeInTheDocument();
  });

  it("fills the free-text rate field when a preset is clicked", async () => {
    render(<ProfileForm initial={null} pending={false} onSubmit={vi.fn()} />);

    await userEvent.selectOptions(
      screen.getByLabelText("Objetivo"),
      "Perder gordura",
    );
    await userEvent.type(screen.getByLabelText("Peso (kg)"), "60");
    await userEvent.click(screen.getByRole("button", { name: /Moderado/ }));

    expect(screen.getByLabelText("Ritmo (kg/semana)")).toHaveValue("0.6");
  });

  it("shows no presets before a weight is entered, and none for manutenção", async () => {
    render(<ProfileForm initial={null} pending={false} onSubmit={vi.fn()} />);

    expect(screen.queryByRole("button", { name: /Leve/ })).not.toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("Peso (kg)"), "60");
    // Default goal is "Manter" — no rate to present at all.
    expect(screen.queryByRole("button", { name: /Leve/ })).not.toBeInTheDocument();
  });
});
