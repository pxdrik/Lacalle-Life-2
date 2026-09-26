import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { formatDecimal } from "@/core/format/decimal";
import { DENSITIES, PHONE_WIDTHS, setDensity, setViewport } from "@/test/geometry";

import type { VolumePoint } from "../services/history";
import { VolumeChart } from "./volume-chart";

/**
 * UI-07 — o gráfico, medido por partes.
 *
 * A Sprint 3 registrou 52px de transbordo a 320px em Confortável e parou ali,
 * porque o brief daquela sprint proibia mexer em gráfico. A Sprint 4 mediu a
 * origem antes de tocar: **as barras nunca transbordam**, em nenhuma das
 * quinze combinações. O transbordo é inteiro da lista de rótulos, que travava
 * num piso de 281px qualquer que fosse a largura disponível — item de flex
 * com `min-width: auto` recusando encolher abaixo do próprio min-content, que
 * aqui é a largura inteira de "29/06" por causa do `whitespace-nowrap`.
 *
 * Com `min-w-0`, 52px viraram 3px. O resto é rótulo que transborda a própria
 * fatia um pouco mais do que o vizinho vazio comporta, e fechá-lo exige
 * decidir quantos rótulos cabem medindo a largura em tempo de execução.
 * Registrado, não remendado — e pinado aqui para não voltar a crescer.
 */

const POINTS: VolumePoint[] = Array.from({ length: 12 }, (_, index) => ({
  startsAt: Date.now() - index * 7 * 86_400_000,
  volumeKg: 1000 + index * 100,
  sets: 6,
  sessions: 2,
  durationMs: 3_600_000,
}));

function mount(points: readonly VolumePoint[]) {
  const { container } = render(
    <VolumeChart
      points={points}
      format={(point) =>
        new Date(point.startsAt).toLocaleDateString("pt-BR").slice(0, 5)
      }
      metric={(point) => point.volumeKg}
      formatMetric={(kg) => `${formatDecimal(kg)} kg`}
    />,
  );

  const card = container.firstElementChild!;
  const lists = card.querySelectorAll("ul");

  return { card, bars: lists[0]!, labels: lists[1]! };
}

describe("UI-07 — o gráfico semanal", () => {
  for (const width of PHONE_WIDTHS) {
    for (const density of DENSITIES) {
      it(`as barras nunca transbordam em ${String(width)}px/${density}`, async () => {
        await setViewport(width, 720);
        setDensity(density);
        const { bars } = mount(POINTS);

        expect(bars.scrollWidth - bars.clientWidth).toBeLessThanOrEqual(0);
      });

      it(`o card não piora além do medido em ${String(width)}px/${density}`, async () => {
        await setViewport(width, 720);
        setDensity(density);
        const { card } = mount(POINTS);

        // Antes do `min-w-0`: 52px no pior caso (320/Confortável). Depois: 3.
        // O teto aqui é o defeito residual conhecido, não uma tolerância
        // escolhida para passar — se voltar a 52, isto fica vermelho.
        expect(card.scrollWidth - card.clientWidth).toBeLessThanOrEqual(4);
      });
    }
  }

  it("deixa as fatias encolherem abaixo do min-content do rótulo", async () => {
    await setViewport(320, 720);
    setDensity("comfortable");
    const { labels } = mount(POINTS);

    // O piso de 281px era o defeito: a lista se recusava a ficar menor que a
    // soma das larguras dos rótulos, qualquer que fosse o espaço disponível.
    expect(labels.scrollWidth).toBeLessThan(281);
  });

  it("não mexe no mensal, que já cabia", async () => {
    await setViewport(320, 720);
    setDensity("comfortable");
    const { card } = mount(POINTS.slice(0, 6));

    expect(card.scrollWidth - card.clientWidth).toBeLessThanOrEqual(0);
  });
});

/**
 * Sprint 5 — rótulos vizinhos não podem se tocar.
 *
 * O `min-w-0` da Sprint 4 resolveu o transbordo do card e, ao permitir que a
 * fatia encolhesse, expôs um defeito que estava escondido atrás dele: o
 * período ativo ganha rótulo sempre, e com 12 pontos ele cai colado no
 * vizinho do passo. Visto em captura antes de ser medido — "14/09"
 * encostando em "21/09".
 *
 * A régua é a caixa de cada rótulo desenhado contra a do seguinte. Contar
 * quantos rótulos aparecem não serviria: o defeito é de posição.
 */
describe("os rótulos desenhados nunca se sobrepõem", () => {
  for (const width of PHONE_WIDTHS) {
    for (const density of DENSITIES) {
      it(`${String(width)}px/${density}`, async () => {
        await setViewport(width, 720);
        setDensity(density);
        const { labels } = mount(POINTS);

        const drawn = [...labels.querySelectorAll("span")].map((span) => ({
          text: span.textContent ?? "",
          box: span.getBoundingClientRect(),
        }));

        expect(drawn.length).toBeGreaterThan(1);

        for (let i = 1; i < drawn.length; i += 1) {
          const previous = drawn[i - 1]!;
          const current = drawn[i]!;
          expect(
            current.box.left,
            `"${previous.text}" encosta em "${current.text}"`,
          ).toBeGreaterThanOrEqual(previous.box.right);
        }
      });
    }
  }

  it("o período ativo nunca perde o rótulo para um vizinho do passo", async () => {
    await setViewport(320, 720);
    setDensity("comfortable");
    const { labels } = mount(POINTS);

    const drawn = [...labels.querySelectorAll("span")];
    const activeLi = [...labels.querySelectorAll("li")].at(-1)!;

    // O mais recente é o ativo por padrão, e é o que a linha de resumo
    // acima descreve — ele é o único que não pode ser omitido.
    expect(activeLi.querySelector("span")).not.toBeNull();
    expect(drawn.length).toBeGreaterThan(1);
  });
});
