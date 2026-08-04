import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Button } from "./button";

describe("Button", () => {
  it("renders its children as the accessible name", () => {
    render(<Button>Adicionar alimento</Button>);

    expect(
      screen.getByRole("button", { name: "Adicionar alimento" }),
    ).toBeInTheDocument();
  });

  it("defaults to type=button so it never submits a form by accident", () => {
    render(<Button>Duplicar</Button>);

    expect(screen.getByRole("button")).toHaveAttribute("type", "button");
  });

  it("still allows an explicit submit button", () => {
    render(<Button type="submit">Salvar</Button>);

    expect(screen.getByRole("button")).toHaveAttribute("type", "submit");
  });

  it("calls onClick when activated", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Salvar</Button>);

    await userEvent.click(screen.getByRole("button"));

    expect(onClick).toHaveBeenCalledOnce();
  });

  it("is reachable and activatable by keyboard alone", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Salvar</Button>);

    await userEvent.tab();
    expect(screen.getByRole("button")).toHaveFocus();

    await userEvent.keyboard("{Enter}");
    expect(onClick).toHaveBeenCalledOnce();
  });

  describe("pending", () => {
    it("announces itself as busy", () => {
      render(<Button pending>Salvar</Button>);

      expect(screen.getByRole("button")).toHaveAttribute("aria-busy", "true");
    });

    it("blocks a second activation", async () => {
      const onClick = vi.fn();
      render(
        <Button pending onClick={onClick}>
          Salvar
        </Button>,
      );

      await userEvent.click(screen.getByRole("button"));

      expect(screen.getByRole("button")).toBeDisabled();
      expect(onClick).not.toHaveBeenCalled();
    });

    it("leaves no aria-busy behind when idle", () => {
      render(<Button>Salvar</Button>);

      expect(screen.getByRole("button")).not.toHaveAttribute("aria-busy");
    });
  });

  it("lets a caller's className win over the variant default", () => {
    render(
      <Button variant="primary" className="bg-danger">
        Excluir
      </Button>,
    );

    const button = screen.getByRole("button");
    expect(button.className).toContain("bg-danger");
    expect(button.className).not.toContain("bg-accent");
  });
});
