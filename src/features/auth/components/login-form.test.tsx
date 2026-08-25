import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { AuthRepositoryProvider } from "../data/auth-repository-context";
import type { AuthRepository } from "../data/auth-repository";
import { LoginForm } from "./login-form";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

function mount(overrides: Partial<AuthRepository> = {}) {
  const repository: AuthRepository = {
    getUser: vi.fn().mockResolvedValue(null),
    signUp: vi.fn(),
    signInWithPassword: vi.fn().mockResolvedValue(undefined),
    signOut: vi.fn(),
    resetPasswordForEmail: vi.fn(),
    updatePassword: vi.fn(),
    onAuthStateChange: vi.fn().mockReturnValue(() => {}),
    ...overrides,
  };

  render(
    <AuthRepositoryProvider repository={repository}>
      <LoginForm />
    </AuthRepositoryProvider>,
  );

  return repository;
}

describe("LoginForm", () => {
  it("submits the typed email and password", async () => {
    const user = userEvent.setup();
    const repository = mount();

    await user.type(screen.getByLabelText("E-mail"), "pedro@example.com");
    await user.type(screen.getByLabelText("Senha"), "senha-secreta");
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    expect(repository.signInWithPassword).toHaveBeenCalledWith(
      "pedro@example.com",
      "senha-secreta",
    );
  });

  it("shows a translated error instead of the raw Supabase message", async () => {
    const user = userEvent.setup();
    mount({
      signInWithPassword: vi.fn().mockRejectedValue(new Error("boom")),
    });

    await user.type(screen.getByLabelText("E-mail"), "pedro@example.com");
    await user.type(screen.getByLabelText("Senha"), "senha-errada");
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    expect(
      await screen.findByText("Algo deu errado. Tente novamente em instantes."),
    ).toBeInTheDocument();
  });
});
