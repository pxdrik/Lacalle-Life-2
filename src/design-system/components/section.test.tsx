import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Section } from "./section";

describe("Section", () => {
  it("renders a titled group with no border on its own root", () => {
    render(
      <Section title="Treinos">
        <p>Volume semanal</p>
      </Section>,
    );

    expect(screen.getByRole("heading", { name: "Treinos" })).toBeInTheDocument();
    expect(screen.getByText("Volume semanal")).toBeInTheDocument();

    const root = screen.getByText("Volume semanal").closest("section");
    expect(root?.className).not.toContain("border ");
  });

  it("shows the subtitle only when one is given", () => {
    const { rerender, container } = render(
      <Section title="Alimentação">x</Section>,
    );
    expect(container.querySelector("p")).not.toBeInTheDocument();

    rerender(
      <Section title="Alimentação" subtitle="O que você comeu hoje">
        x
      </Section>,
    );
    expect(screen.getByText("O que você comeu hoje")).toBeInTheDocument();
  });

  it("places the action beside the title, not inside it", () => {
    render(
      <Section title="Alimentação" action={<button type="button">Registrar</button>}>
        x
      </Section>,
    );

    const heading = screen.getByRole("heading", { name: "Alimentação" });
    const action = screen.getByRole("button", { name: "Registrar" });
    expect(heading).not.toContainElement(action);
  });

  it("draws the top divider only when asked", () => {
    const { rerender } = render(<Section title="Treinos">x</Section>);
    expect(screen.getByText("x").closest("section")?.className).not.toContain(
      "border-t",
    );

    rerender(
      <Section title="Treinos" divider>
        x
      </Section>,
    );
    expect(screen.getByText("x").closest("section")?.className).toContain(
      "border-t",
    );
  });
});
