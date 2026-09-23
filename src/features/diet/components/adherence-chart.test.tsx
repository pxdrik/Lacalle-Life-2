import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import type { AdherencePoint } from "../services/diet-adherence";
import { AdherenceChart } from "./adherence-chart";

const points: readonly AdherencePoint[] = [
  { startsAt: 3, checkedMeals: 4, plannedMeals: 8, daysWithPlan: 4 },
  { startsAt: 2, checkedMeals: 0, plannedMeals: 0, daysWithPlan: 0 },
  { startsAt: 1, checkedMeals: 6, plannedMeals: 6, daysWithPlan: 3 },
];

const format = (point: AdherencePoint) => `semana ${String(point.startsAt)}`;

describe("AdherenceChart", () => {
  it("shows the most recent point's fraction as real text", () => {
    // `points` arrives most-recent-first, same convention `VolumeChart` uses
    // — index 0 (startsAt: 3) is what the summary defaults to.
    render(<AdherenceChart points={points} format={format} />);

    const summary = screen.getByText("4 de 8").closest("p")!;
    expect(within(summary).getByText(/semana 3/)).toBeInTheDocument();
  });

  it("switches the summary when a different bar is pressed", async () => {
    render(<AdherenceChart points={points} format={format} />);

    await userEvent.click(
      screen.getByRole("button", { name: /semana 1.*6 de 6/ }),
    );

    expect(screen.getByText("6 de 6")).toBeInTheDocument();
  });

  it("reads a week with no diet scheduled as its own state, not 0%", () => {
    render(<AdherenceChart points={points} format={format} />);

    expect(
      screen.getByRole("button", { name: "semana 2: nenhuma dieta vinculada" }),
    ).toBeInTheDocument();
  });

  it("uses the singular for exactly one planned meal", () => {
    const single: readonly AdherencePoint[] = [
      { startsAt: 1, checkedMeals: 1, plannedMeals: 1, daysWithPlan: 1 },
    ];

    render(<AdherenceChart points={single} format={format} />);

    expect(screen.getByText(/refeição planejada\b/)).toBeInTheDocument();
    expect(screen.queryByText(/refeições planejadas/)).not.toBeInTheDocument();
  });

  it("renders nothing when there are no points, instead of crashing", () => {
    const { container } = render(<AdherenceChart points={[]} format={format} />);

    expect(container.querySelectorAll("button")).toHaveLength(0);
  });

  /**
   * RM10 (roadmap 23/09/2026): este gráfico é a mesma receita de
   * `VolumeChart` (treinos), e herdou o mesmo bug que já tinha sido
   * corrigido lá em 17/09/2026 — 12 semanas rotuladas por inteiro numa tela
   * de celular truncava o texto até sobrar um caractere solto. A correção
   * portada é a mesma: rotular só um ponto a cada `labelStep`, sem truncar
   * o que fica visível.
   */
  it("skips labels past a step instead of truncating them, with 12 weeks", () => {
    const weeks: readonly AdherencePoint[] = Array.from(
      { length: 12 },
      (_, i) => ({
        startsAt: 12 - i,
        checkedMeals: 1,
        plannedMeals: 2,
        daysWithPlan: 1,
      }),
    );

    render(<AdherenceChart points={weeks} format={format} />);

    // labelStep = ceil(12 / 6) = 2 → índices pares (0,2,4,6,8,10) pelo
    // passo, mais o índice ativo (11, o mais recente, ímpar) fora do passo —
    // 7 rótulos visíveis. Cronologia reversa: índice i = semana (i + 1).
    expect(screen.getAllByText(/^semana \d+$/)).toHaveLength(7);
    // Semana 10 (índice 9, ímpar, fora do passo e não é a ativa) não
    // deveria aparecer.
    expect(screen.queryByText("semana 10")).not.toBeInTheDocument();
    // A mais recente (semana 12) é o índice ativo por padrão — sempre visível.
    expect(screen.getByText("semana 12")).toBeInTheDocument();
  });
});
