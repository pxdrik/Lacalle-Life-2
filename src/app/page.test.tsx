import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import LandingPage from "./page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
}));

vi.mock("@/core/auth/env", () => ({
  isSupabaseConfigured: () => false,
}));

/**
 * Fumaça da Landing Page pública: as seções obrigatórias existem, e os três
 * caminhos de entrada (criar conta, entrar, experimentar sem conta) levam
 * para onde a especificação pede.
 */
describe("LandingPage", () => {
  it("renders the hero headline and both primary CTAs", () => {
    render(<LandingPage />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /Seu treino\. Sua alimentação\. Sua evolução\./,
      }),
    ).toBeInTheDocument();

    expect(
      screen.getAllByRole("link", { name: "Criar minha conta" })[0],
    ).toHaveAttribute("href", "/cadastro");
    expect(
      screen.getAllByRole("link", { name: "Entrar" })[0],
    ).toHaveAttribute("href", "/entrar");
  });

  it("offers a discrete way to try the app without an account", () => {
    render(<LandingPage />);

    const tryLinks = screen.getAllByRole("link", {
      name: /experimente sem (criar )?conta/i,
    });
    expect(tryLinks.length).toBeGreaterThan(0);
    for (const link of tryLinks) {
      expect(link).toHaveAttribute("href", "/hoje");
    }
  });

  it("explains the difference between using with and without an account", () => {
    render(<LandingPage />);

    expect(screen.getByText("Sem conta")).toBeInTheDocument();
    expect(screen.getByText("Com conta")).toBeInTheDocument();
    expect(
      screen.getByText(/Seus dados ficam salvos neste dispositivo/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/podem ser sincronizados entre seus dispositivos/),
    ).toBeInTheDocument();
  });

  it("presents the three existing pillars, not invented ones", () => {
    render(<LandingPage />);

    expect(
      screen.getAllByRole("heading", { level: 2, name: "Alimentação" }).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getByRole("heading", { level: 2, name: "Treinos" }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("heading", { level: 2, name: "Evolução" }).length,
    ).toBeGreaterThan(0);
  });
});
