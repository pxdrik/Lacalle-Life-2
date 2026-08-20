import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import type { VolumePoint } from "../services/history";
import { VolumeChart } from "./volume-chart";

/**
 * BUG-016 (auditoria externa, 14/08): "gráficos de volume só têm valor em
 * `title`, que não abre no celular". Estes testes travam o que o `title` não
 * cobria — o valor visível na árvore normal do DOM, sem depender de hover.
 */

const points: readonly VolumePoint[] = [
  { startsAt: 3, volumeKg: 4200, sets: 12, sessions: 2, durationMs: 0 },
  { startsAt: 2, volumeKg: 0, sets: 0, sessions: 0, durationMs: 0 },
  { startsAt: 1, volumeKg: 8450, sets: 14, sessions: 3, durationMs: 0 },
];

const format = (point: VolumePoint) => `período ${String(point.startsAt)}`;

describe("VolumeChart", () => {
  it("shows the most recent point's value as real text, not just a title", () => {
    render(<VolumeChart points={points} format={format} />);

    // `points` chega do serviço com o mais recente primeiro; a barra mais à
    // direita (a última depois do `reverse` interno) é `startsAt: 3`. O
    // período também aparece sob a própria barra, então a busca é restrita ao
    // parágrafo do resumo.
    const summary = screen.getByText("4.200 kg").closest("p")!;
    expect(within(summary).getByText(/12 séries/)).toBeInTheDocument();
    expect(within(summary).getByText(/período 3/)).toBeInTheDocument();
  });

  it("keeps the summary discoverable without any hover — it is not sr-only", () => {
    render(<VolumeChart points={points} format={format} />);

    const summary = screen.getByText("4.200 kg");
    // `sr-only` teria `position: absolute` fora do fluxo — checar que o texto
    // é o conteúdo visível de um parágrafo comum é o que garante que um olho
    // sem leitor de tela também o encontra.
    expect(summary.closest("p")).not.toHaveClass("sr-only");
  });

  it("switches the summary when a different bar is pressed", async () => {
    render(<VolumeChart points={points} format={format} />);

    await userEvent.click(
      screen.getByRole("button", { name: /período 1.*8.450 kg/ }),
    );

    expect(screen.getByText("8.450 kg")).toBeInTheDocument();
    expect(screen.getByText(/14 séries/)).toBeInTheDocument();
  });

  it("marks the pressed bar and no other", async () => {
    render(<VolumeChart points={points} format={format} />);

    const first = screen.getByRole("button", { name: /período 1/ });
    const last = screen.getByRole("button", { name: /período 3/ });

    // O mais recente é o padrão até alguém tocar em outra barra.
    expect(last).toHaveAttribute("aria-pressed", "true");
    expect(first).toHaveAttribute("aria-pressed", "false");

    await userEvent.click(first);

    expect(first).toHaveAttribute("aria-pressed", "true");
    expect(last).toHaveAttribute("aria-pressed", "false");
  });

  it("gives every bar an accessible name carrying its value — reachable by keyboard, not only touch", () => {
    render(<VolumeChart points={points} format={format} />);

    // sets = 0 usa plural — "0 séries", como "0 séries" se diz em português —
    // então o padrão testa o texto inteiro, não um recorte que dependeria de
    // acertar a gramática do fixture.
    expect(
      screen.getByRole("button", {
        name: "período 2: 0 kg em 0 séries",
      }),
    ).toBeInTheDocument();
  });

  it("uses the singular for exactly one set", () => {
    const single: readonly VolumePoint[] = [
      { startsAt: 1, volumeKg: 100, sets: 1, sessions: 1, durationMs: 0 },
    ];

    render(<VolumeChart points={single} format={format} />);

    expect(screen.getByText(/1 série\b/)).toBeInTheDocument();
    expect(screen.queryByText(/1 séries/)).not.toBeInTheDocument();
  });

  /**
   * O objetivo explícito de BUG-016 não é imprimir um número por barra —
   * isso lotaria o gráfico. Este teste é o guarda-costas dessa decisão: com
   * três pontos, só um valor em quilos deve estar visível de uma vez (o do
   * resumo), não três.
   */
  it("prints exactly one visible kg figure at a time, not one per bar", () => {
    render(<VolumeChart points={points} format={format} />);

    const kgFigures = screen.getAllByText(/kg$/);
    expect(kgFigures).toHaveLength(1);
  });

  it("renders nothing when there are no points, instead of crashing", () => {
    const { container } = render(<VolumeChart points={[]} format={format} />);

    expect(container.querySelectorAll("button")).toHaveLength(0);
  });
});

describe("charting a different metric", () => {
  // `metric`/`formatMetric` existem pra este gráfico virar o de duração em
  // Evolução sem duplicar a barra, o resumo e o teclado inteiros — kg
  // continua sendo o padrão para quem já chamava sem os dois props.
  const withDuration: readonly VolumePoint[] = [
    { startsAt: 2, volumeKg: 1000, sets: 5, sessions: 1, durationMs: 90_000 },
    { startsAt: 1, volumeKg: 500, sets: 3, sessions: 1, durationMs: 30_000 },
  ];

  it("draws bars and summary from the chosen metric, not volumeKg", () => {
    render(
      <VolumeChart
        points={withDuration}
        format={format}
        metric={(point) => point.durationMs}
        formatMetric={(ms) => `${String(ms / 1000)}s`}
      />,
    );

    expect(screen.getByText("90s")).toBeInTheDocument();
    expect(screen.queryByText(/kg/)).not.toBeInTheDocument();
  });
});
