import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ConfirmButton } from "./confirm-button";

function setup(onConfirm = vi.fn()) {
  render(
    <>
      <ConfirmButton onConfirm={onConfirm} label="Excluir Treino A">
        Excluir
      </ConfirmButton>
      <button type="button">outro</button>
    </>,
  );

  return onConfirm;
}

const trigger = () => screen.getByRole("button", { name: /Treino A/ });

describe("ConfirmButton", () => {
  it("does nothing on the first tap", async () => {
    const onConfirm = setup();

    await userEvent.click(trigger());

    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("says what the second tap will do", async () => {
    setup();

    await userEvent.click(trigger());

    expect(
      screen.getByRole("button", { name: "Confirmar: Excluir Treino A" }),
    ).toBeInTheDocument();
  });

  it("fires on the second tap", async () => {
    const onConfirm = setup();

    await userEvent.click(trigger());
    await userEvent.click(trigger());

    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("returns to idle after firing, so it cannot fire twice", async () => {
    const onConfirm = setup();

    await userEvent.click(trigger());
    await userEvent.click(trigger());
    await userEvent.click(trigger());

    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("disarms when focus moves away", async () => {
    // An armed button left behind by a mis-tap must not fire later.
    const onConfirm = setup();

    await userEvent.click(trigger());
    await userEvent.click(screen.getByRole("button", { name: "outro" }));
    await userEvent.click(trigger());

    expect(onConfirm).not.toHaveBeenCalled();
  });
});

describe("timeout", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("disarms on its own after a few seconds", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onConfirm = vi.fn();

    render(
      <ConfirmButton onConfirm={onConfirm} label="Excluir Treino A">
        Excluir
      </ConfirmButton>,
    );

    await user.click(trigger());
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(screen.getByRole("button", { name: "Excluir Treino A" })).toBeInTheDocument();

    await user.click(trigger());
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
