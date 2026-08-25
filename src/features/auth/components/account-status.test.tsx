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
  it("shows the anonymous notice when there is no session", async () => {
    mount();

    expect(
      await screen.findByText("Você não está logado"),
    ).toBeInTheDocument();
  });

  it("shows the user's id and email when a session exists", async () => {
    mount({ getUser: vi.fn().mockResolvedValue(USER) });

    expect(await screen.findByText("pedro@example.com")).toBeInTheDocument();
    expect(screen.getByText(USER.id)).toBeInTheDocument();
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

    expect(await screen.findByText("Você não está logado")).toBeInTheDocument();

    notify(USER);

    expect(await screen.findByText("pedro@example.com")).toBeInTheDocument();
  });
});
