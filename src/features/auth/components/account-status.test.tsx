import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { AuthRepositoryProvider } from "../data/auth-repository-context";
import type { AuthRepository } from "../data/auth-repository";
import type { AuthUser } from "../types/auth-user";
import { AccountStatus } from "./account-status";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

const USER: AuthUser = { id: "11111111-1111-1111-1111-111111111111", email: "pedro@example.com" };

function mount(overrides: Partial<AuthRepository> = {}) {
  const repository: AuthRepository = {
    getUser: vi.fn().mockResolvedValue(null),
    signUp: vi.fn(),
    signInWithPassword: vi.fn(),
    signOut: vi.fn().mockResolvedValue(undefined),
    resetPasswordForEmail: vi.fn(),
    updatePassword: vi.fn(),
    onAuthStateChange: vi.fn().mockReturnValue(() => {}),
    ...overrides,
  };

  render(
    <AuthRepositoryProvider repository={repository}>
      <AccountStatus />
    </AuthRepositoryProvider>,
  );

  return repository;
}

describe("AccountStatus", () => {
  // Roadmap 9.1 (30/09/2026): sem conta, diz o que isso significa e
  // oferece Entrar (o botão verde) e Criar conta.
  it("explains what using without an account means, and offers both ways in", async () => {
    mount();

    expect(await screen.findByText("Você está usando sem conta")).toBeInTheDocument();
    expect(screen.getByText(/Seus dados ficam só neste aparelho/)).toBeInTheDocument();
    const signIn = screen.getByRole("link", { name: "Entrar" });
    expect(signIn).toHaveAttribute("href", "/entrar");
    expect(signIn.className).toContain("bg-accent-fill");
    expect(screen.getByRole("link", { name: "Criar conta" })).toHaveAttribute("href", "/cadastro");
  });

  it("shows the user's email when a session exists", async () => {
    mount({ getUser: vi.fn().mockResolvedValue(USER) });

    expect(await screen.findByText("pedro@example.com")).toBeInTheDocument();
  });

  it("offers a way to change the password", async () => {
    mount({ getUser: vi.fn().mockResolvedValue(USER) });

    expect(
      await screen.findByRole("link", { name: "Trocar senha" }),
    ).toHaveAttribute("href", "/atualizar-senha");
  });

  it("calls signOut and does not crash when Sair is pressed", async () => {
    const user = userEvent.setup();
    const repository = mount({ getUser: vi.fn().mockResolvedValue(USER) });

    await user.click(await screen.findByRole("button", { name: "Sair" }));

    expect(repository.signOut).toHaveBeenCalledOnce();
  });

  it("reflects onAuthStateChange even without a matching getUser result", async () => {
    let notify: (user: AuthUser | null) => void = () => {};

    mount({
      getUser: vi.fn().mockResolvedValue(null),
      onAuthStateChange: vi.fn((callback: (user: AuthUser | null) => void) => {
        notify = callback;
        return () => {};
      }),
    });

    expect(await screen.findByText("Você está usando sem conta")).toBeInTheDocument();

    notify(USER);

    expect(await screen.findByText("pedro@example.com")).toBeInTheDocument();
  });
});
