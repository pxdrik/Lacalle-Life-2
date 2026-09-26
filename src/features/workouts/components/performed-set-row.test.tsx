import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { PerformedSet } from "../types/session";
import { PerformedSetRow } from "./performed-set-row";

function set(overrides: Partial<PerformedSet> = {}): PerformedSet {
  return {
    id: "s1",
    reps: 10,
    weightKg: 60,
    rpe: null,
    durationSeconds: null,
    isCompleted: false,
    planned: null,
    ...overrides,
  };
}

function mount(value: PerformedSet, isNext = true, isCardio = false) {
  const onChange = vi.fn();

  render(
    <ul>
      <PerformedSetRow
        set={value}
        index={0}
        exerciseName="Supino"
        isNext={isNext}
        isCardio={isCardio}
        onChange={onChange}
        onToggleComplete={vi.fn()}
        onRemove={vi.fn()}
      />
    </ul>,
  );

  return onChange;
}

const tap = (name: RegExp) =>
  userEvent.click(screen.getByRole("button", { name }));

/**
 * The confirmation on a finished set belongs to the tap, not to the state.
 *
 * Keyed off `isCompleted` it would have fired on mount, so reopening a workout
 * with twenty-four finished sets would set twenty-four checks bouncing at once
 * — which is the difference between an app that acknowledges you and one that
 * congratulates you for scrolling.
 */
describe("marking a set as done", () => {
  // Anchored, because "Remover série 1 de Supino" also contains "série 1".
  const TOGGLE = /^Desmarcar série 1/;
  const check = () =>
    screen.getByRole("button", { name: TOGGLE }).querySelector("svg");

  it("stays still when a set arrives already completed", () => {
    mount(set({ isCompleted: true }));

    expect(check()).not.toHaveClass("animate-pop");
  });

  it("confirms the set the moment it is tapped", async () => {
    // `onToggleComplete` belongs to the parent, so this row never sees
    // `isCompleted` flip on its own — mounting it completed and tapping puts
    // the component in the state the real screen puts it in.
    mount(set({ isCompleted: true }));
    await tap(TOGGLE);

    expect(check()).toHaveClass("animate-pop");
  });
});

describe("Iniciativa D — a finished set reads at a glance", () => {
  function row() {
    // The inner `.group` div carries the surface/border — the `<li>` above
    // it is only the collapse-on-remove grid track (`useCollapsibleRemove`)
    // and never gets these classes itself. Walk up from a stable child
    // rather than relying on a container query that could match the wrong
    // element.
    return screen.getByText("1").closest(".group");
  }

  it("gives a finished set a filled, bordered surface", () => {
    mount(set({ isCompleted: true }), false);

    expect(row()).toHaveClass("bg-muted", "border-line");
  });

  it("never dims the row with opacity — that used to fade the check itself", () => {
    mount(set({ isCompleted: true }), false);

    expect(row()).not.toHaveClass("opacity-60");
  });

  it("leaves an unfinished, non-next set with no surface at all", () => {
    mount(set({ isCompleted: false }), false);

    expect(row()).not.toHaveClass("bg-muted");
    expect(row()).not.toHaveClass("border-line");
  });
});

describe("Focus Transition — the next set to do", () => {
  function row() {
    return screen.getByText("1").closest(".group");
  }

  it("gets the accent bar and a highlighted surface", () => {
    mount(set({ isCompleted: false }), true);

    expect(row()).toHaveClass("border-l-accent", "bg-muted");
  });

  it("reserves the bar's width even when not next, so it never shifts layout", () => {
    mount(set({ isCompleted: false }), false);

    // Transparent, not absent: `border-l-[3px]` stays in the class list either
    // way — only the colour utility (`border-l-accent`) is conditional.
    expect(row()).toHaveClass("border-l-[3px]");
    expect(row()).not.toHaveClass("border-l-accent");
  });
});

describe("Delete/Collapse — removing a set shrinks before it goes", () => {
  it("does not remove on the tap itself — only once the row finishes shrinking", async () => {
    const onRemove = vi.fn();
    render(
      <ul>
        <PerformedSetRow
          set={set()}
          index={0}
          exerciseName="Supino"
          isNext={false}
          isCardio={false}
          onChange={vi.fn()}
          onToggleComplete={vi.fn()}
          onRemove={onRemove}
        />
      </ul>,
    );

    // Remover saiu da linha em 26/09/2026 e foi para a folha de ações que o
    // número da série abre — seis alvos da classe 44px não cabiam em 360px.
    // O contrato sob teste não mudou: a remoção continua esperando o
    // encolhimento terminar, só o caminho até ela é outro.
    await userEvent.click(
      screen.getByRole("button", { name: "Ações da série 1 de Supino" }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Remover série 1 de Supino" }),
    );
    expect(onRemove).not.toHaveBeenCalled();

    const li = screen.getByText("1").closest("li")!;
    fireEvent.transitionEnd(li, { propertyName: "grid-template-rows" });
    expect(onRemove).toHaveBeenCalledTimes(1);
  });
});

/**
 * Os steppers −1/+1/−2,5/+2,5 saíram do produto (pedido do Pedro,
 * 17/09/2026) — o campo continua editável por digitação, só o controle
 * extra some. Estes testes provam as duas coisas: nenhum stepper renderiza
 * em nenhum estado da linha, e digitar direto no campo ainda funciona.
 */
describe("sem steppers, só digitação direta", () => {
  it("nunca renderiza os botões de incremento/decremento de peso ou reps", () => {
    mount(set(), true);

    expect(
      screen.queryByRole("button", { name: /^Mais 2,5 kg/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^Menos 2,5 kg/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^Mais uma repetição/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^Menos uma repetição/ }),
    ).not.toBeInTheDocument();
  });

  it("digitar no campo de reps ainda chama onChange", async () => {
    // O input de reps não tem estado próprio de rascunho (ao contrário do
    // de peso, ver `WeightField`) — é controlado direto pelo prop `set`, que
    // este mount não atualiza a cada tecla. Uma tecla é o bastante para
    // provar que a digitação continua chamando `onChange`.
    const onChange = mount(set({ reps: null }));

    await userEvent.type(
      screen.getByLabelText("Repetições da série 1 de Supino"),
      "5",
    );

    expect(onChange).toHaveBeenLastCalledWith({ reps: 5 });
  });

  it("digitar no campo de peso ainda chama onChange", async () => {
    const onChange = mount(set({ weightKg: null }));

    await userEvent.type(
      screen.getByLabelText("Peso da série 1 de Supino"),
      "62,5",
    );

    expect(onChange).toHaveBeenLastCalledWith({ weightKg: 62.5 });
  });
});

describe("a cardio exercise", () => {
  it("shows a duration field instead of reps and weight", () => {
    mount(set({ reps: null, weightKg: null, durationSeconds: 2400 }), true, true);

    expect(
      screen.getByLabelText("Duração da série 1 de Supino, em minutos"),
    ).toHaveValue("40");
    expect(
      screen.queryByLabelText("Repetições da série 1 de Supino"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText("Peso da série 1 de Supino"),
    ).not.toBeInTheDocument();
  });

  it("writes the typed minutes to durationSeconds through onChange", async () => {
    const onChange = mount(set({ durationSeconds: null }), true, true);
    const field = screen.getByLabelText(
      "Duração da série 1 de Supino, em minutos",
    );

    await userEvent.type(field, "40");

    expect(onChange).toHaveBeenLastCalledWith({ durationSeconds: 2400 });
  });

  it("has no RPE selector, which rates effort against a target it has none of", () => {
    mount(set({ durationSeconds: null }), true, true);

    expect(
      screen.queryByLabelText("RPE da série 1 de Supino"),
    ).not.toBeInTheDocument();
  });

  it("has no rep/weight steppers, which have no cardio equivalent", () => {
    mount(set({ durationSeconds: null }), true, true);

    expect(
      screen.queryByRole("button", { name: /^Mais uma repetição/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^Mais 2,5 kg/ }),
    ).not.toBeInTheDocument();
  });

  it("a non-cardio exercise still shows reps and weight as before", () => {
    mount(set(), true, false);

    expect(
      screen.getByLabelText("Repetições da série 1 de Supino"),
    ).toBeInTheDocument();
    expect(
      screen.queryByLabelText("Duração da série 1 de Supino, em minutos"),
    ).not.toBeInTheDocument();
  });
});
