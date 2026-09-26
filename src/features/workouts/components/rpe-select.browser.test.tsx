import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { setViewport } from "@/test/geometry";

import { RPE_SCALE } from "../taxonomy/rpe";
import { RpeSelect } from "./rpe-select";

/**
 * A geometria do RPE, medida num SVG de verdade.
 *
 * Os testes antigos deste componente viviam em jsdom e **falsificavam**
 * `getBoundingClientRect` e `svg.viewBox.baseVal`, porque jsdom não desenha
 * SVG. A partir dali eles mediam o próprio fixture: os dois defeitos da
 * auditoria (C1 e C2) passaram por dezesseis testes verdes. Aqui o navegador
 * faz o layout e as coordenadas são pixels de tela.
 *
 * O que cada bloco protege:
 *
 * - **C1**: a faixa abaixo do centro do mostrador dobrava sobre os extremos.
 *   Medido no código antigo: 14,3% do retângulo clicável só produzia 6 ou 10,
 *   e dois pixels separavam RPE 8 de RPE 10.
 * - **C2**: a posição vinha do valor numérico numa escala não uniforme, então
 *   RPE 7 tinha 2,6 vezes mais alvo que RPE 8.
 */

const LABEL = "RPE da série 1 de Supino";
const LAST = RPE_SCALE.length - 1;

/** O mostrador, em unidades do próprio viewBox. Repetido aqui de propósito:
 * se o desenho mudar, estes testes têm que ser relidos, não ajustados. */
const VIEWBOX = { width: 280, height: 150 };
const CENTRE = { x: 140, y: 128 };
const RADIUS = 110;

async function openPicker(value: number | null = null) {
  await setViewport(390, 800);
  const onChange = vi.fn();
  render(
    <RpeSelect value={value} onChange={onChange} label={LABEL} />,
  );
  screen.getByRole("button", { name: LABEL }).click();
  const slider = await screen.findByRole("slider", { name: LABEL });

  return { onChange, slider };
}

/**
 * Converte um ponto do viewBox para coordenadas de tela, do mesmo jeito que
 * o navegador converte: escala uniforme (`xMidYMid meet`), conteúdo centrado
 * na caixa. Não reusa a função do componente — um teste que chama a fórmula
 * sob teste só prova que ela é igual a si mesma.
 */
function toClient(slider: Element, x: number, y: number) {
  const rect = slider.getBoundingClientRect();
  const scale = Math.min(
    rect.width / VIEWBOX.width,
    rect.height / VIEWBOX.height,
  );

  return {
    clientX:
      rect.left + (rect.width - VIEWBOX.width * scale) / 2 + x * scale,
    clientY:
      rect.top + (rect.height - VIEWBOX.height * scale) / 2 + y * scale,
  };
}

/** Um ponto sobre o arco, no ângulo pedido. 0 aponta para cima, negativo
 * para a esquerda. `radiusFactor` afasta ou aproxima do centro. */
function pointAtAngle(
  slider: Element,
  angleDeg: number,
  radiusFactor = 0.8,
) {
  const radians = (angleDeg * Math.PI) / 180;
  const r = RADIUS * radiusFactor;

  return toClient(
    slider,
    CENTRE.x + Math.sin(radians) * r,
    CENTRE.y - Math.cos(radians) * r,
  );
}

function press(slider: Element, point: { clientX: number; clientY: number }) {
  slider.dispatchEvent(
    new PointerEvent("pointerdown", {
      bubbles: true,
      pointerId: 1,
      ...point,
    }),
  );
}

beforeEach(() => {
  // `setPointerCapture` exige um ponteiro realmente ativo; os eventos
  // sintéticos acima não criam um, e a captura não é o que se mede aqui.
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
});

/** O ângulo do centro da banda de cada degrau, por índice. */
function angleForIndex(index: number): number {
  return (index / LAST - 0.5) * 180;
}

describe("cada um dos oito valores da escala pode ser escolhido", () => {
  for (const [index, step] of RPE_SCALE.entries()) {
    it(`RPE ${step.label}`, async () => {
      const { onChange, slider } = await openPicker();

      press(slider, pointAtAngle(slider, angleForIndex(index)));

      expect(onChange).toHaveBeenCalledWith(step.value);
    });
  }
});

describe("C2 — as bandas do meio têm a mesma largura", () => {
  /**
   * Varre o arco em passos finos e mede quantos graus cada valor ocupa.
   *
   * As duas pontas ficam com meia banda no arco **por construção** (o
   * primeiro e o último degrau ficam nas extremidades, não no centro de uma
   * banda), então a asserção é sobre os seis valores do meio. Exigir
   * uniformidade das oito seria exigir uma geometria que o mostrador não
   * tem, e é isso que o Pedro pediu para não fazer.
   */
  it("nenhum valor do meio tem alvo maior que outro", async () => {
    const { onChange, slider } = await openPicker();
    const spanByValue = new Map<number, number>();
    const STEP_DEG = 0.25;

    for (let angle = -90; angle <= 90; angle += STEP_DEG) {
      onChange.mockClear();
      press(slider, pointAtAngle(slider, angle));
      const picked = onChange.mock.calls.at(-1)?.[0] as number | undefined;
      if (picked === undefined) continue;
      spanByValue.set(picked, (spanByValue.get(picked) ?? 0) + STEP_DEG);
    }

    const middle = RPE_SCALE.slice(1, -1).map((step) => ({
      label: step.label,
      span: spanByValue.get(step.value) ?? 0,
    }));

    const widest = Math.max(...middle.map((entry) => entry.span));
    const narrowest = Math.min(...middle.map((entry) => entry.span));

    expect(
      widest / narrowest,
      `bandas desiguais: ${middle.map((e) => `${e.label}=${e.span.toFixed(1)}°`).join(" ")}`,
    ).toBeLessThanOrEqual(1.1);

    // E todos os oito são alcançáveis por algum ângulo do arco.
    expect([...spanByValue.keys()].sort((a, b) => a - b)).toEqual(
      RPE_SCALE.map((step) => step.value),
    );
  });
});

describe("C1 — a região abaixo do centro não escolhe mais nada", () => {
  it("um pixel acima do centro escolhe o meio da escala; um abaixo não escolhe nada", async () => {
    const { onChange, slider } = await openPicker();

    // O par exato que o código antigo transformava em 8 contra 10.
    press(slider, toClient(slider, CENTRE.x, CENTRE.y - 1));
    const above = onChange.mock.calls.at(-1)?.[0] as number | undefined;
    expect(above).toBe(RPE_SCALE[Math.round(LAST / 2)]!.value);

    onChange.mockClear();
    press(slider, toClient(slider, CENTRE.x, CENTRE.y + 1));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("nenhum ponto abaixo do centro escolhe valor, em toda a largura", async () => {
    const { onChange, slider } = await openPicker();

    for (let x = 0; x <= VIEWBOX.width; x += 4) {
      for (let y = CENTRE.y + 1; y <= VIEWBOX.height; y += 4) {
        onChange.mockClear();
        press(slider, toClient(slider, x, y));
        expect(
          onChange,
          `(${String(x)}, ${String(y)}) escolheu um valor abaixo do centro`,
        ).not.toHaveBeenCalled();
      }
    }
  });

  it("os cantos superiores, fora do mostrador, também não escolhem", async () => {
    const { onChange, slider } = await openPicker();

    for (const corner of [
      { x: 2, y: 2 },
      { x: VIEWBOX.width - 2, y: 2 },
    ]) {
      onChange.mockClear();
      press(slider, toClient(slider, corner.x, corner.y));
      expect(
        onChange,
        `canto (${String(corner.x)}, ${String(corner.y)}) escolheu um valor`,
      ).not.toHaveBeenCalled();
    }
  });
});

describe("a região válida do mostrador responde inteira", () => {
  it("esquerda, direita, cima e as diagonais escolhem o valor daquele ângulo", async () => {
    const { onChange, slider } = await openPicker();

    const cases = [
      { name: "esquerda", angle: -90, expected: RPE_SCALE[0]!.value },
      { name: "cima", angle: 0, expected: RPE_SCALE[Math.round(LAST / 2)]!.value },
      { name: "direita", angle: 90, expected: RPE_SCALE[LAST]!.value },
    ];

    for (const testCase of cases) {
      onChange.mockClear();
      press(slider, pointAtAngle(slider, testCase.angle));
      expect(
        onChange.mock.calls.at(-1)?.[0],
        `${testCase.name} (${String(testCase.angle)}°)`,
      ).toBe(testCase.expected);
    }
  });

  it("arrastar além da ponta prende no extremo, nunca sai da escala", async () => {
    // Vinha de `rpe-select.test.tsx`, onde só podia existir em cima de um
    // `getBoundingClientRect` falsificado. Aqui o arrasto é medido: começa
    // sobre o mostrador, sai dele, e o valor prende na ponta daquele lado.
    const { onChange, slider } = await openPicker();

    for (const side of [
      { name: "direita", from: 80, to: 2000, expected: RPE_SCALE[LAST]!.value },
      { name: "esquerda", from: -80, to: -2000, expected: RPE_SCALE[0]!.value },
    ]) {
      onChange.mockClear();
      press(slider, pointAtAngle(slider, side.from));

      const start = pointAtAngle(slider, side.from);
      slider.dispatchEvent(
        new PointerEvent("pointermove", {
          bubbles: true,
          pointerId: 1,
          clientX: start.clientX + side.to,
          clientY: start.clientY,
        }),
      );

      expect(onChange.mock.calls.at(-1)?.[0], side.name).toBe(side.expected);
    }
  });

  it("perto do centro e perto da borda do arco dão o mesmo valor, no mesmo ângulo", async () => {
    const { onChange, slider } = await openPicker();

    for (const angle of [-60, -20, 0, 35, 70]) {
      const picks = new Set<number>();
      for (const factor of [0.25, 0.6, 0.95, 1.15]) {
        onChange.mockClear();
        press(slider, pointAtAngle(slider, angle, factor));
        const picked = onChange.mock.calls.at(-1)?.[0] as number | undefined;
        if (picked !== undefined) picks.add(picked);
      }

      expect(
        picks.size,
        `${String(angle)}° deu valores diferentes conforme a distância do centro: ${[...picks].join(", ")}`,
      ).toBe(1);
    }
  });
});

describe("as fronteiras entre valores vizinhos", () => {
  it("um passo de cada lado da fronteira cai em degraus adjacentes", async () => {
    const { onChange, slider } = await openPicker();
    const halfBand = 180 / LAST / 2;

    for (let index = 0; index < LAST; index += 1) {
      const border = angleForIndex(index) + halfBand;

      onChange.mockClear();
      press(slider, pointAtAngle(slider, border - 1.5));
      const before = onChange.mock.calls.at(-1)?.[0] as number | undefined;

      onChange.mockClear();
      press(slider, pointAtAngle(slider, border + 1.5));
      const after = onChange.mock.calls.at(-1)?.[0] as number | undefined;

      expect(before, `antes da fronteira ${String(index)}`).toBe(
        RPE_SCALE[index]!.value,
      );
      expect(after, `depois da fronteira ${String(index)}`).toBe(
        RPE_SCALE[index + 1]!.value,
      );
    }
  });
});

describe("o mapeamento não depende do tamanho do componente", () => {
  it("o mesmo ângulo dá o mesmo valor em duas larguras diferentes", async () => {
    for (const width of [320, 414]) {
      await setViewport(width, 800);
      const onChange = vi.fn();
      const { unmount } = render(
        <RpeSelect value={null} onChange={onChange} label={LABEL} />,
      );
      screen.getByRole("button", { name: LABEL }).click();
      const slider = await screen.findByRole("slider", { name: LABEL });

      for (const [index] of RPE_SCALE.entries()) {
        onChange.mockClear();
        press(slider, pointAtAngle(slider, angleForIndex(index)));
        expect(
          onChange.mock.calls.at(-1)?.[0],
          `largura ${String(width)}, índice ${String(index)}`,
        ).toBe(RPE_SCALE[index]!.value);
      }

      unmount();
    }
  });
});

describe("o portal não deixa nada para trás no consumidor", () => {
  it("o componente contribui com um nó só para a árvore de quem o usa", async () => {
    await setViewport(390, 800);
    const { container } = render(
      <div data-testid="host">
        <RpeSelect value={8} onChange={vi.fn()} label={LABEL} />
      </div>,
    );

    const host = container.querySelector("[data-testid=host]");
    expect(host?.children).toHaveLength(1);
    expect(host?.firstElementChild?.tagName).toBe("BUTTON");
    expect(host?.querySelector("dialog")).toBeNull();
  });

  it("a folha aberta é filha do body, e fecha sem sobrar nada visível", async () => {
    const { slider } = await openPicker(8);

    const dialog = slider.closest("dialog");
    expect(dialog?.parentElement).toBe(document.body);
    expect(dialog?.open).toBe(true);

    screen.getByRole("button", { name: "Confirmar" }).click();

    // Nada aqui é síncrono, e as duas razões são reais: o `close()` nativo
    // sai de um efeito do React, e depois dele a folha ainda leva 200ms de
    // transição de saída (`allow-discrete`, `globals.css`) antes de sumir da
    // árvore de acessibilidade. O elemento continua montado de propósito —
    // desmontá-lo cortaria essa transição — então o que se espera é que ele
    // feche e deixe de ser alcançável, não que suma do DOM.
    await waitFor(() => {
      expect(dialog?.open).toBe(false);
      expect(screen.queryByRole("slider")).not.toBeInTheDocument();
    });
  });
});
