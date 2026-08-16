import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { DISARM_AFTER_MS } from "@/design-system/hooks/use-armed";

import { ConfirmButton } from "./confirm-button";

/**
 * The bar that shows how long an armed confirmation has left.
 *
 * Hesitating over "encerrar o treino com 5 séries pendentes?" — the exact
 * moment worth hesitating over — used to throw the decision away in silence.
 */

function mount() {
  render(
    <ConfirmButton
      onConfirm={vi.fn()}
      label="Excluir Treino A"
      confirmLabel="Excluir?"
    >
      Excluir
    </ConfirmButton>,
  );
}

const arm = () => userEvent.click(screen.getByRole("button"));
const bar = () => document.querySelector(".animate-drain");

describe("the draining bar", () => {
  it("appears only once the button is armed", async () => {
    mount();
    expect(bar()).toBeNull();

    await arm();

    expect(bar()).not.toBeNull();
  });

  it("runs exactly as long as the timer it reports on", async () => {
    // The whole point is that the two agree. A bar promising more time than
    // the timer allows is worse than no bar at all.
    mount();

    await arm();

    expect(bar()).toHaveStyle({
      animationDuration: `${String(DISARM_AFTER_MS)}ms`,
    });
  });

  it("stays out of the accessibility tree, which has the label already", async () => {
    mount();

    await arm();

    expect(bar()).toHaveAttribute("aria-hidden");
  });

  it("carries the variant that hides it under reduced motion", async () => {
    // Asserted as a class because jsdom does not evaluate media queries, so
    // the rendered outcome cannot be observed here. What this pins down is
    // the mechanism: without it the global rule that caps every animation at
    // 120ms would compress the several-second countdown into a flash, reading
    // as expired the instant it appeared.
    mount();

    await arm();

    expect(bar()).toHaveClass("motion-reduce:hidden");
  });
});
