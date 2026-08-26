import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CustomExerciseForm } from "./custom-exercise-form";

/**
 * Achado testando ao vivo (Pedro, 25/08/2026): com um nome de menos de 3
 * letras, "Criar e usar" fica desabilitado sem nenhuma mensagem — o clique
 * simplesmente não faz nada, e nada na tela explica por quê. De fora,
 * indistinguível de um botão quebrado.
 */
describe("CustomExerciseForm", () => {
  it("explica por que o botão não responde quando o nome é curto demais", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(
      <CustomExerciseForm
        initialName=""
        pending={false}
        onSubmit={onSubmit}
        onCancel={vi.fn()}
      />,
    );

    await user.type(screen.getByLabelText("Nome do exercício"), "Zq");

    expect(
      screen.getByText("Dê um nome com pelo menos 3 letras."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Criar e usar" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Criar e usar" }));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("some com o aviso e libera o botão a partir de 3 letras", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(
      <CustomExerciseForm
        initialName=""
        pending={false}
        onSubmit={onSubmit}
        onCancel={vi.fn()}
      />,
    );

    const input = screen.getByLabelText("Nome do exercício");
    await user.type(input, "Supino reto");

    expect(
      screen.queryByText("Dê um nome com pelo menos 3 letras."),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Criar e usar" }));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Supino reto" }),
    );
  });

  it("não mostra o aviso com o campo vazio", () => {
    render(
      <CustomExerciseForm
        initialName=""
        pending={false}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(
      screen.queryByText("Dê um nome com pelo menos 3 letras."),
    ).not.toBeInTheDocument();
  });
});
