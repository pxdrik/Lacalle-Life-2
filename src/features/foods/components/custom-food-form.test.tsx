import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CustomFoodForm } from "./custom-food-form";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));

/**
 * Validation runs on submit, which is the right moment to *raise* an error and
 * the wrong one to be the only moment that can *clear* it. Before this, the
 * form kept saying "Nome muito longo." beside a name the person had already
 * shortened — the app contradicting the screen, right after asking for a fix.
 */

function mountForm() {
  render(
    <CustomFoodForm
      initial={null}
      save={vi.fn(async () => true)}
      pending={false}
      error={null}
    />,
  );
}

const nameField = () => screen.getByLabelText("Nome");
const submit = () => screen.getByRole("button", { name: /Salvar/ });

describe("clearing a validation message", () => {
  it("drops the message once the field is edited", async () => {
    mountForm();

    await userEvent.type(nameField(), "x".repeat(125));
    await userEvent.click(submit());
    expect(await screen.findByText("Nome muito longo.")).toBeInTheDocument();

    await userEvent.clear(nameField());
    await userEvent.type(nameField(), "Barra proteica");

    expect(screen.queryByText("Nome muito longo.")).not.toBeInTheDocument();
  });

  it("leaves the other fields' messages alone", async () => {
    // Clearing everything on any keystroke would hide problems the person has
    // not addressed yet.
    mountForm();

    await userEvent.type(nameField(), "x".repeat(125));
    await userEvent.click(submit());

    await userEvent.type(nameField(), "ok");

    expect(screen.queryByText("Nome muito longo.")).not.toBeInTheDocument();
    expect(screen.getByText("Preencha as calorias.")).toBeInTheDocument();
  });

  it("clears the cross-field macro rule when a macro is edited", async () => {
    // "Protein + carbs + fat exceed 100 g" belongs to no single field, so it
    // has to be resolvable by editing any of them.
    mountForm();

    await userEvent.type(nameField(), "Impossível");
    await userEvent.type(screen.getByLabelText("Calorias"), "500");
    await userEvent.type(screen.getByLabelText("Proteína"), "60");
    await userEvent.type(screen.getByLabelText("Carboidrato"), "60");
    await userEvent.type(screen.getByLabelText("Gordura"), "10");
    await userEvent.click(submit());

    const sumError = await screen.findByText(/somam mais de 100 g/);
    expect(sumError).toBeInTheDocument();

    await userEvent.clear(screen.getByLabelText("Carboidrato"));
    await userEvent.type(screen.getByLabelText("Carboidrato"), "20");

    expect(screen.queryByText(/somam mais de 100 g/)).not.toBeInTheDocument();
  });
});
