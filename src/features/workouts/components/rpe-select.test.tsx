import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { RPE_SCALE } from "../taxonomy/rpe";
import { RpeSelect } from "./rpe-select";

const LABEL = "RPE da série 1 de Supino";
const LAST_INDEX = RPE_SCALE.length - 1;

/**
 * O que **não** é geometria.
 *
 * Teclado, rótulos, abrir e fechar, "Sem RPE". A parte geométrica deste
 * componente mudou de arquivo na Fase 3 (26/09/2026) e vive em
 * `rpe-select.browser.test.tsx`, num navegador de verdade.
 *
 * O motivo é o defeito que este arquivo deixou passar. jsdom não desenha
 * SVG, então os testes de arrasto precisavam falsificar
 * `getBoundingClientRect` **e** `svg.viewBox.baseVal` para existir — e a
 * partir dali mediam o próprio fixture. Os dois defeitos da auditoria (a
 * faixa abaixo do centro dobrando sobre os extremos, e as bandas desiguais
 * por mapear pelo valor em vez do índice) passaram por dezesseis testes
 * verdes deste arquivo. Ângulo se mede onde há layout.
 */
beforeEach(() => {
  // O que sobrou aqui usa ponteiro só para *chegar* a um comportamento
  // (soltar o arrasto não fecha a folha; Confirmar fecha). Basta que o
  // toque caia em algum ponto válido do mostrador; o que o ângulo daquele
  // ponto significa é medido no navegador, não aqui.
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
  // jsdom não implementa nenhum dos dois — mesma lacuna que o teste do
  // `Dialog` documenta para `showModal`/`close`. Um fato do ambiente, não
  // deste componente.
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
});

/** Direto acima do centro do mostrador (140, 128): um ponto válido. */
const ON_DIAL = { clientX: 140, clientY: 28 };

function mount(value: number | null) {
  const onChange = vi.fn();
  render(<RpeSelect value={value} onChange={onChange} label={LABEL} />);
  return onChange;
}

function slider() {
  return screen.getByRole("slider", { name: LABEL });
}

async function open() {
  await userEvent.click(screen.getByRole("button", { name: LABEL }));
}

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

  it("o ponteiro aponta pra esquerda no mínimo da escala", () => {
    mount(RPE_SCALE[0]!.value);
    const min = screen
      .getByRole("button", { name: LABEL })
      .querySelector("line");
    expect(min).toHaveAttribute("transform", expect.stringContaining("-90"));
  });

  it("abre a folha com o mostrador grande em vez da grade de botões", async () => {
    mount(null);
    await open();

    expect(slider()).toBeInTheDocument();
    expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument();
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
  });

  /**
   * Por índice, não por valor. A escala é uma lista de oito posições, e
   * anunciar "7,5 de 6 a 10" descreveria um intervalo contínuo que não
   * existe — não há RPE 8,2. `aria-valuetext` carrega o valor real, que é o
   * padrão para escala não linear.
   */
  it("anuncia a posição na escala, e o valor real em aria-valuetext", async () => {
    mount(7.5);
    await open();

    const el = slider();
    expect(el).toHaveAttribute("aria-valuemin", "0");
    expect(el).toHaveAttribute("aria-valuemax", String(LAST_INDEX));
    expect(el).toHaveAttribute("aria-valuenow", "2");
    expect(el).toHaveAttribute("aria-valuetext", "7,5");
  });

  it("sem valor, não anuncia posição nenhuma em vez de mentir um 6", async () => {
    mount(null);
    await open();

    const el = slider();
    expect(el).not.toHaveAttribute("aria-valuenow");
    expect(el).toHaveAttribute("aria-valuetext", "Sem RPE");
  });

  it("soltar o arrasto não fecha a folha sozinho — só o botão Confirmar fecha", async () => {
    // Revertido a pedido do Pedro, 17/09/2026: "deixe um botão para
    // confirmar o RPE" — soltar o dedo só marca o fim do arrasto agora,
    // não é mais o mesmo gesto que fecha a folha.
    mount(null);
    await open();

    fireEvent.pointerDown(slider(), { pointerId: 1, ...ON_DIAL });
    fireEvent.pointerUp(slider(), { pointerId: 1, ...ON_DIAL });

    expect(screen.getByRole("slider")).toBeInTheDocument();
  });

  it("Confirmar fecha a folha sem mudar o valor por conta própria", async () => {
    const onChange = mount(null);
    await open();
    fireEvent.pointerDown(slider(), { pointerId: 1, ...ON_DIAL });
    fireEvent.pointerUp(slider(), { pointerId: 1, ...ON_DIAL });
    onChange.mockClear();

    await userEvent.click(screen.getByRole("button", { name: "Confirmar" }));

    expect(screen.queryByRole("slider")).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("'Sem RPE' limpa o valor e fecha a folha", async () => {
    const onChange = mount(8);
    await open();

    await userEvent.click(screen.getByRole("button", { name: "Sem RPE" }));

    expect(onChange).toHaveBeenCalledWith(null);
    expect(screen.queryByRole("slider")).not.toBeInTheDocument();
  });
});

describe("teclado", () => {
  it("seta pra direita avança um degrau da escala", async () => {
    const onChange = mount(8);
    await open();

    fireEvent.keyDown(slider(), { key: "ArrowRight" });

    expect(onChange).toHaveBeenLastCalledWith(8.5);
  });

  it("seta pra esquerda volta um degrau da escala", async () => {
    const onChange = mount(8);
    await open();

    fireEvent.keyDown(slider(), { key: "ArrowLeft" });

    expect(onChange).toHaveBeenLastCalledWith(7.5);
  });

  it("seta pra cima e pra baixo fazem o mesmo que direita e esquerda", async () => {
    const onChange = mount(8);
    await open();

    fireEvent.keyDown(slider(), { key: "ArrowUp" });
    expect(onChange).toHaveBeenLastCalledWith(8.5);

    fireEvent.keyDown(slider(), { key: "ArrowDown" });
    expect(onChange).toHaveBeenLastCalledWith(7.5);
  });

  it("nas pontas, a seta não sai da escala", async () => {
    const onChange = mount(RPE_SCALE[LAST_INDEX]!.value);
    await open();

    fireEvent.keyDown(slider(), { key: "ArrowRight" });

    expect(onChange).toHaveBeenLastCalledWith(RPE_SCALE[LAST_INDEX]!.value);
  });

  it("End vai direto pro máximo da escala", async () => {
    const onChange = mount(RPE_SCALE[0]!.value);
    await open();

    fireEvent.keyDown(slider(), { key: "End" });

    expect(onChange).toHaveBeenLastCalledWith(RPE_SCALE[LAST_INDEX]!.value);
  });

  it("Home vai direto pro mínimo da escala", async () => {
    const onChange = mount(RPE_SCALE[LAST_INDEX]!.value);
    await open();

    fireEvent.keyDown(slider(), { key: "Home" });

    expect(onChange).toHaveBeenLastCalledWith(RPE_SCALE[0]!.value);
  });

  /**
   * Regra explícita, não aritmética acidental. Antes, `findIndex` devolvia
   * −1 para "Sem RPE" e as duas setas caíam no primeiro degrau por conta de
   * `Math.min`/`Math.max` — o resultado certo pelo motivo errado, que é
   * exatamente o tipo de coisa que muda sozinha quando alguém mexe na
   * fórmula. O comportamento observável continua o mesmo: a primeira seta
   * estabelece uma posição, e ela é o começo da escala.
   */
  for (const key of ["ArrowRight", "ArrowLeft", "ArrowUp", "ArrowDown"]) {
    it(`partindo de 'Sem RPE', ${key} estabelece o primeiro degrau`, async () => {
      const onChange = mount(null);
      await open();

      fireEvent.keyDown(slider(), { key });

      expect(onChange).toHaveBeenLastCalledWith(RPE_SCALE[0]!.value);
    });
  }

  it("uma tecla que não é do controle passa direto", async () => {
    const onChange = mount(8);
    await open();

    fireEvent.keyDown(slider(), { key: "a" });
    fireEvent.keyDown(slider(), { key: "Tab" });

    expect(onChange).not.toHaveBeenCalled();
  });
});
