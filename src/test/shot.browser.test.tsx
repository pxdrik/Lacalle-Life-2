import { render, screen } from "@testing-library/react";
import { describe, it, vi } from "vitest";
import { page } from "vitest/browser";
import { setViewport } from "@/test/geometry";
import { RpeSelect } from "@/features/workouts/components/rpe-select";
import { RPE_SCALE } from "@/features/workouts/taxonomy/rpe";

const LABEL = "RPE da série 1 de Supino";

describe("ponteiro", () => {
  for (const theme of ["light", "dark"] as const) {
    for (const step of RPE_SCALE) {
      it(`${theme} ${step.label}`, async () => {
        await setViewport(390, 420);
        document.documentElement.setAttribute("data-theme", theme);
        render(<RpeSelect value={step.value} onChange={vi.fn()} label={LABEL} />);
        screen.getByRole("button", { name: LABEL }).click();
        await screen.findByRole("slider", { name: LABEL });
        await page.screenshot({ path: `shots/${theme}-${step.label.replace(",", "-")}.png` });
      });
    }
  }
});
