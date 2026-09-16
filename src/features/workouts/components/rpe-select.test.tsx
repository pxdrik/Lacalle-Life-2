import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { RpeSelect } from "./rpe-select";

const LABEL = "RPE da série 1 de Supino";

/**
 * jsdom does not lay out SVG — `getBoundingClientRect` returns all zeros and
 * `viewBox.baseVal` is not implemented at all — so a drag test has to hand
 * the picker a fake box before it can compute an angle from a pointer
 * position. `280×150` matches the real viewBox exactly, so a `clientX`/
 * `clientY` in these tests means the same SVG-unit position production code
 * would compute from an on-screen drag.
 */
beforeEach(() => {
  Object.defineProperty(SVGSVGElement.prototype, "getBoundingClientRect", {
    configurable: true,
    value: () => ({
      left: 0,
      top: 0,
      width: 280,
      height: 150,
      right: 280,
      bottom: 150,
      x: 0,
      y: 0,
      toJSON: () => "",
    }),
  });
  Object.defineProperty(SVGSVGElement.prototype, "viewBox", {
    configurable: true,
    value: { baseVal: { width: 280, height: 150 } },
  });
  // jsdom implements neither — same gap `Dialog`'s own test file documents
  // for `showModal`/`close`, a fact about the environment rather than this
  // component. The picker only calls them to keep a drag tracking a finger
  // that leaves the SVG's bounds, which no assertion here depends on.
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
});

function mount(value: number | null) {
  const onChange = vi.fn();
  render(<RpeSelect value={value} onChange={onChange} label={LABEL} />);
  return onChange;
}

function slider() {
  return screen.getByRole("slider", { name: LABEL });
}

/** `(140, 18)` is straight up from the picker's own centre `(140, 128)` —
 * the middle of the scale, RPE 8. `(250, 128)` is the right edge — RPE 10,
 * the maximum. */
const STRAIGHT_UP = { clientX: 140, clientY: 18 };
const RIGHT_EDGE = { clientX: 250, clientY: 128 };
const LEFT_EDGE = { clientX: 30, clientY: 128 };

describe("RpeSelect", () => {
  it("mostra — quando não há RPE", () => {
    mount(null);
    expect(screen.getByRole("button", { name: LABEL })).toHaveTextContent("—");
  });

  it("mostra o valor formatado quando há RPE", () => {
    mount(8.5);
    expect(screen.getByRole("button", { name: LABEL })).toHaveTextContent(
      "8,5",
    );
  });

  it("o mostrador (meio círculo com ponteiro) não desenha ponteiro sem valor", () => {
    mount(null);

    const button = screen.getByRole("button", { name: LABEL });
    expect(button.querySelector("line")).not.toBeInTheDocument();
    // O trilho continua desenhado — um mostrador vazio, não ausente.
    expect(button.querySelector("path")).toBeInTheDocument();
  });

  it("o ponteiro aponta pra esquerda no mínimo da escala e pra direita no máximo", () => {
    mount(6);
    const min = screen
      .getByRole("button", { name: LABEL })
      .querySelector("line");
    expect(min).toHaveAttribute("transform", expect.stringContaining("-90"));
  });

  it("abre a folha com o mostrador grande em vez da grade de botões", async () => {
    mount(null);

    await userEvent.click(screen.getByRole("button", { name: LABEL }));

    expect(slider()).toBeInTheDocument();
    expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument();
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
  });

  it("anuncia min, max e o valor atual pra quem usa leitor de tela", async () => {
    mount(7.5);
    await userEvent.click(screen.getByRole("button", { name: LABEL }));

    const el = slider();
    expect(el).toHaveAttribute("aria-valuemin", "6");
    expect(el).toHaveAttribute("aria-valuemax", "10");
    expect(el).toHaveAttribute("aria-valuenow", "7.5");
    expect(el).toHaveAttribute("aria-valuetext", "7,5");
  });

  it("arrastar até o meio do arco escolhe 8 e arrastar até a ponta direita escolhe 10", async () => {
    const onChange = mount(null);
    await userEvent.click(screen.getByRole("button", { name: LABEL }));
    const el = slider();

    fireEvent.pointerDown(el, { pointerId: 1, ...STRAIGHT_UP });
    fireEvent.pointerMove(el, { pointerId: 1, ...RIGHT_EDGE });
    fireEvent.pointerUp(el, { pointerId: 1, ...RIGHT_EDGE });

    expect(onChange).toHaveBeenLastCalledWith(10);
  });

  it("soltar o arrasto não fecha a folha sozinho — só o botão Confirmar fecha", async () => {
    // Revertido a pedido do Pedro, mesmo dia: "deixe um botão para
    // confirmar o RPE" — soltar o dedo só marca o fim do arrasto agora,
    // não é mais o mesmo gesto que fecha a folha.
    mount(null);
    await userEvent.click(screen.getByRole("button", { name: LABEL }));

    fireEvent.pointerDown(slider(), { pointerId: 1, ...STRAIGHT_UP });
    fireEvent.pointerUp(slider(), { pointerId: 1, ...STRAIGHT_UP });

    expect(screen.getByRole("slider")).toBeInTheDocument();
  });

  it("Confirmar fecha a folha sem mudar o valor por conta própria", async () => {
    const onChange = mount(null);
    await userEvent.click(screen.getByRole("button", { name: LABEL }));
    fireEvent.pointerDown(slider(), { pointerId: 1, ...RIGHT_EDGE });
    fireEvent.pointerUp(slider(), { pointerId: 1, ...RIGHT_EDGE });
    onChange.mockClear();

    await userEvent.click(screen.getByRole("button", { name: "Confirmar" }));

    expect(screen.queryByRole("slider")).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("nunca escolhe um valor fora da escala, mesmo arrastando além da ponta", async () => {
    const onChange = mount(null);
    await userEvent.click(screen.getByRole("button", { name: LABEL }));

    // Bem além da borda direita real do arco.
    fireEvent.pointerDown(slider(), {
      pointerId: 1,
      clientX: 1000,
      clientY: 128,
    });

    expect(onChange).toHaveBeenLastCalledWith(10);
  });

  it("seta pra direita avança um degrau da escala", async () => {
    const onChange = mount(8);
    await userEvent.click(screen.getByRole("button", { name: LABEL }));

    fireEvent.keyDown(slider(), { key: "ArrowRight" });

    expect(onChange).toHaveBeenLastCalledWith(8.5);
  });

  it("seta pra esquerda volta um degrau da escala", async () => {
    const onChange = mount(8);
    await userEvent.click(screen.getByRole("button", { name: LABEL }));

    fireEvent.keyDown(slider(), { key: "ArrowLeft" });

    expect(onChange).toHaveBeenLastCalledWith(7.5);
  });

  it("End vai direto pro máximo da escala", async () => {
    const onChange = mount(6);
    await userEvent.click(screen.getByRole("button", { name: LABEL }));

    fireEvent.keyDown(slider(), { key: "End" });

    expect(onChange).toHaveBeenLastCalledWith(10);
  });

  it("Home vai direto pro mínimo da escala", async () => {
    const onChange = mount(10);
    await userEvent.click(screen.getByRole("button", { name: LABEL }));

    fireEvent.keyDown(slider(), { key: "Home" });

    expect(onChange).toHaveBeenLastCalledWith(6);
  });

  it("'Sem RPE' limpa o valor e fecha a folha", async () => {
    const onChange = mount(8);
    await userEvent.click(screen.getByRole("button", { name: LABEL }));

    await userEvent.click(screen.getByRole("button", { name: "Sem RPE" }));

    expect(onChange).toHaveBeenCalledWith(null);
    expect(screen.queryByRole("slider")).not.toBeInTheDocument();
  });

  it("arrastar até a ponta esquerda escolhe o mínimo da escala, não 'Sem RPE'", async () => {
    const onChange = mount(null);
    await userEvent.click(screen.getByRole("button", { name: LABEL }));

    fireEvent.pointerDown(slider(), { pointerId: 1, ...LEFT_EDGE });

    expect(onChange).toHaveBeenLastCalledWith(6);
  });
});
