import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { RpeSelect } from "./rpe-select";

const LABEL = "RPE da série 1 de Supino";

function mount(value: number | null) {
  const onChange = vi.fn();
  render(<RpeSelect value={value} onChange={onChange} label={LABEL} />);
  return onChange;
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

  it("abre a folha com todos os valores ao tocar o gatilho", async () => {
    mount(null);

    await userEvent.click(screen.getByRole("button", { name: LABEL }));

    expect(screen.getByRole("radiogroup", { name: LABEL })).toBeInTheDocument();
    for (const label of ["6", "7", "7,5", "8", "8,5", "9", "9,5", "10"]) {
      // O nome acessível do botão junta os dois `<span>` (valor + descrição),
      // então a busca casa só o início — "9" não pode casar "9,5" por engano.
      expect(
        screen.getByRole("radio", { name: new RegExp(`^${label} `) }),
      ).toBeInTheDocument();
    }
  });

  it("escolher um valor chama onChange e fecha a folha", async () => {
    const onChange = mount(null);

    await userEvent.click(screen.getByRole("button", { name: LABEL }));
    await userEvent.click(screen.getByRole("radio", { name: /^9 / }));

    expect(onChange).toHaveBeenCalledWith(9);
    expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument();
  });

  it("escolher 'Sem RPE' limpa o valor", async () => {
    const onChange = mount(8);

    await userEvent.click(screen.getByRole("button", { name: LABEL }));
    await userEvent.click(screen.getByRole("radio", { name: /Sem RPE/ }));

    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("marca o valor atual como selecionado", async () => {
    mount(7.5);

    await userEvent.click(screen.getByRole("button", { name: LABEL }));

    expect(screen.getByRole("radio", { name: /^7,5 / })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByRole("radio", { name: /^9 / })).toHaveAttribute(
      "aria-checked",
      "false",
    );
  });
});
