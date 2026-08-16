import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ConfirmButton } from "./confirm-button";

function setup(onConfirm = vi.fn()) {
  render(
    <>
      <ConfirmButton
        onConfirm={onConfirm}
        label="Excluir Treino A"
        confirmLabel="Excluir?"
      >
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
      screen.getByRole("button", { name: "Excluir?: Excluir Treino A" }),
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

/**
 * BUG-006 (auditoria externa, 14/08): `overflow-hidden` vivia no mesmo
 * elemento que carrega `touch-44`, e recortava o pseudo-elemento que a
 * utility usa para expandir a área de toque. Medido no navegador antes da
 * correção: um botão que desenha 16×16px tinha área de toque efetiva de
 * 15×15 — abaixo até da própria caixa visual, porque o recorte também comia
 * a borda do `::after`. Depois da correção, a mesma medição no navegador deu
 * 44×44. Estes testes travam a estrutura que torna isso possível; a medição
 * geométrica real, que o jsdom não faz, está registrada em
 * `docs/roadmap.md`.
 */
describe("touch target (BUG-006)", () => {
  it("keeps the interactive button free of overflow-hidden", () => {
    render(
      <ConfirmButton onConfirm={vi.fn()} label="Excluir Treino A" confirmLabel="Excluir?">
        Excluir
      </ConfirmButton>,
    );

    // `touch-44`'s `::after` extends past the button's own 16–32px box up to
    // 44×44 — `overflow-hidden` on the same element clips that pseudo-element
    // right back down to the box it was meant to grow past. This is the
    // element BUG-006 measured at 15×15px.
    const classes = [...trigger().classList];
    expect(classes).toContain("touch-44");
    expect(classes).not.toContain("overflow-hidden");
  });

  it("clips the confirmation bar in a layer separate from the touch target", async () => {
    render(
      <ConfirmButton onConfirm={vi.fn()} label="Excluir Treino A" confirmLabel="Excluir?">
        Excluir
      </ConfirmButton>,
    );

    await userEvent.click(trigger());

    const bar = document.querySelector(".animate-drain");
    expect(bar).not.toBeNull();

    // The drain bar's rounded-corner clipping has to live *somewhere* — the
    // regression this guards against is it moving back onto the button.
    const clipped = bar!.closest(".overflow-hidden");
    expect(clipped).not.toBeNull();
    expect(clipped).not.toBe(trigger());
    expect(trigger().contains(clipped)).toBe(true);
  });

  it("still fires on the second tap with the bar in its own layer", async () => {
    // The two-tap flow does not read anything from the wrapper span; this
    // guards against the refactor accidentally breaking the click handler by
    // catching a click that lands on the wrapper instead of the button.
    const onConfirm = vi.fn();
    render(
      <ConfirmButton onConfirm={onConfirm} label="Excluir Treino A" confirmLabel="Excluir?">
        Excluir
      </ConfirmButton>,
    );

    await userEvent.click(trigger());
    await userEvent.click(trigger());

    expect(onConfirm).toHaveBeenCalledOnce();
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
      <ConfirmButton
        onConfirm={onConfirm}
        label="Excluir Treino A"
        confirmLabel="Excluir?"
      >
        Excluir
      </ConfirmButton>,
    );

    await user.click(trigger());
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(
      screen.getByRole("button", { name: "Excluir Treino A" }),
    ).toBeInTheDocument();

    await user.click(trigger());
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
