import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { AuthRepositoryProvider } from "../data/auth-repository-context";
import type { AuthRepository } from "../data/auth-repository";
import { SignupForm } from "./signup-form";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

function mount(overrides: Partial<AuthRepository> = {}) {
  const repository: AuthRepository = {
    getUser: vi.fn().mockResolvedValue(null),
    signUp: vi.fn().mockResolvedValue({ needsEmailConfirmation: true }),
    signInWithPassword: vi.fn(),
    signOut: vi.fn(),
    resetPasswordForEmail: vi.fn(),
    updatePassword: vi.fn(),
    onAuthStateChange: vi.fn().mockReturnValue(() => {}),
    ...overrides,
  };

  render(
    <AuthRepositoryProvider repository={repository}>
      <SignupForm />
    </AuthRepositoryProvider>,
  );

  return repository;
}

async function fillAndSubmit(
  user: ReturnType<typeof userEvent.setup>,
  { email, password, confirm }: { email: string; password: string; confirm: string },
) {
  await user.type(screen.getByLabelText("E-mail"), email);
  await user.type(screen.getByLabelText("Senha"), password);
  await user.type(screen.getByLabelText("Confirme a senha"), confirm);
  await user.click(screen.getByRole("button", { name: "Criar conta" }));
}

describe("SignupForm", () => {
  it("rejects a password shorter than 8 characters without calling the repository", async () => {
    const user = userEvent.setup();
    const repository = mount();

    await fillAndSubmit(user, {
      email: "pedro@example.com",
      password: "1234567",
      confirm: "1234567",
    });

    expect(
      await screen.findByText(/pelo menos 8 caracteres/),
    ).toBeInTheDocument();
    expect(repository.signUp).not.toHaveBeenCalled();
  });

  it("rejects mismatched passwords without calling the repository", async () => {
    const user = userEvent.setup();
    const repository = mount();

    await fillAndSubmit(user, {
      email: "pedro@example.com",
      password: "senha-forte-1",
      confirm: "senha-forte-2",
    });

    expect(await screen.findByText("As senhas não são iguais.")).toBeInTheDocument();
    expect(repository.signUp).not.toHaveBeenCalled();
  });

  it("shows the confirmation notice instead of redirecting when email confirmation is required", async () => {
    const user = userEvent.setup();
    mount({ signUp: vi.fn().mockResolvedValue({ needsEmailConfirmation: true }) });

    await fillAndSubmit(user, {
      email: "pedro@example.com",
      password: "senha-forte-1",
      confirm: "senha-forte-1",
    });

    expect(await screen.findByText("Confira seu e-mail")).toBeInTheDocument();
  });
});
