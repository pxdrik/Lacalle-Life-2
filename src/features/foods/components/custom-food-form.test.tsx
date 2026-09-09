import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { Food } from "../types/food";
import { CustomFoodForm } from "./custom-food-form";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));

const SAVED: Food = {
  id: "saved-1",
  name: "Barra proteica",
  category: "protein",
  per100g: { kcal: 100, proteinG: 10, carbsG: 10, fatG: 1 },
  isCustom: true,
  isFavorite: false,
  createdAt: 1,
  updatedAt: 1,
};

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
      save={vi.fn(async () => SAVED)}
      pending={false}
      error={null}
    />,
  );
}

const nameField = () => screen.getByLabelText("Nome");
const submit = () => screen.getByRole("button", { name: /Salvar/ });

/**
 * Fills the name past its limit, in one input event rather than 125.
 *
 * `type` simulates a keystroke at a time, and 125 of them means 125 React
 * renders — enough that this file was the slowest in the suite and timed out
 * against the 5s limit whenever the machine was busy, three times in one
 * afternoon. Nothing here depends on the *number* of keystrokes: validation
 * runs on submit, and what clears the message is a subsequent edit, which
 * every test below still performs with a real `type`.
 */
async function tooLongName() {
  await userEvent.click(nameField());
  await userEvent.paste("x".repeat(125));
}

describe("clearing a validation message", () => {
  it("drops the message once the field is edited", async () => {
    mountForm();

    await tooLongName();
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

    await tooLongName();
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

describe("the practical unit toggle", () => {
  it("hides the unit fields until the toggle is switched on", () => {
    mountForm();

    expect(screen.queryByLabelText("Nome da medida")).not.toBeInTheDocument();
  });

  it("reveals the fields on toggle, and sends the unit on save", async () => {
    const save = vi.fn(async () => SAVED);
    render(
      <CustomFoodForm initial={null} save={save} pending={false} error={null} />,
    );

    await userEvent.type(nameField(), "Pão caseiro");
    await userEvent.type(screen.getByLabelText("Calorias"), "250");
    await userEvent.type(screen.getByLabelText("Proteína"), "8");
    await userEvent.type(screen.getByLabelText("Carboidrato"), "45");
    await userEvent.type(screen.getByLabelText("Gordura"), "3");

    await userEvent.click(
      screen.getByRole("button", { name: "Adicionar medida caseira" }),
    );
    await userEvent.type(screen.getByLabelText("Nome da medida"), "1 fatia");
    await userEvent.type(screen.getByLabelText("Peso dessa medida"), "50");
    await userEvent.click(submit());

    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({
        practicalUnit: { label: "1 fatia", grams: 50 },
      }),
    );
  });

  it("requires the weight once the toggle is on, but not before", async () => {
    mountForm();

    await userEvent.type(nameField(), "Pão caseiro");
    await userEvent.type(screen.getByLabelText("Calorias"), "250");
    await userEvent.type(screen.getByLabelText("Proteína"), "8");
    await userEvent.type(screen.getByLabelText("Carboidrato"), "45");
    await userEvent.type(screen.getByLabelText("Gordura"), "3");
    await userEvent.click(
      screen.getByRole("button", { name: "Adicionar medida caseira" }),
    );
    await userEvent.type(screen.getByLabelText("Nome da medida"), "1 fatia");
    // Weight left blank on purpose.
    await userEvent.click(submit());

    expect(
      await screen.findByText("Preencha quantos gramas essa medida tem."),
    ).toBeInTheDocument();
  });
});
