import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ThemeProvider } from "@/design-system/theme/theme-provider";

import { AuthRepositoryProvider } from "../data/auth-repository-context";
import type { AuthRepository } from "../data/auth-repository";
import { LoginForm } from "./login-form";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

const getTurnstileSiteKey = vi.fn().mockReturnValue(undefined);
vi.mock("@/core/auth/env", () => ({
  getTurnstileSiteKey: () => getTurnstileSiteKey(),
}));

// `useTurnstile` agora lê o tema atual para o widget (achado de auditoria de
// design, 02/09/2026), então `LoginForm` precisa de um `ThemeProvider` por
// perto — e `ThemeProvider` precisa de um `matchMedia`, que o jsdom não tem.
beforeEach(() => {
  vi.stubGlobal("matchMedia", (media: string) => ({
    media,
    matches: false,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
});

afterEach(() => {
  getTurnstileSiteKey.mockReturnValue(undefined);
  delete (window as { turnstile?: unknown }).turnstile;
  document
    .querySelectorAll('script[src*="challenges.cloudflare.com"]')
    .forEach((el) => {
      el.remove();
    });
});

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
    <ThemeProvider>
      <AuthRepositoryProvider repository={repository}>
        <LoginForm />
      </AuthRepositoryProvider>
    </ThemeProvider>,
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
      // Sem CAPTCHA configurado neste teste — `undefined`, o mesmo que o
      // Supabase já trata como "sem token" e ignora.
      undefined,
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

describe("LoginForm — CAPTCHA", () => {
  it("desabilita o botão sem token quando o CAPTCHA está configurado", async () => {
    getTurnstileSiteKey.mockReturnValue("site-key-de-teste");
    const user = userEvent.setup();
    const repository = mount();

    await user.type(screen.getByLabelText("E-mail"), "pedro@example.com");
    await user.type(screen.getByLabelText("Senha"), "senha-secreta");

    const submitButton = screen.getByRole("button", { name: "Entrar" });
    expect(submitButton).toBeDisabled();

    await user.click(submitButton);
    expect(repository.signInWithPassword).not.toHaveBeenCalled();
  });

  it("repassa o token do widget e reseta depois do envio", async () => {
    getTurnstileSiteKey.mockReturnValue("site-key-de-teste");
    let capturedCallback: ((token: string) => void) | undefined;
    const reset = vi.fn();
    window.turnstile = {
      render: (_container, options) => {
        capturedCallback = options.callback;
        return "widget-1";
      },
      reset,
      remove: vi.fn(),
    };

    const user = userEvent.setup();
    const repository = mount();
    capturedCallback?.("token-do-widget");

    await user.type(screen.getByLabelText("E-mail"), "pedro@example.com");
    await user.type(screen.getByLabelText("Senha"), "senha-secreta");
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    expect(repository.signInWithPassword).toHaveBeenCalledWith(
      "pedro@example.com",
      "senha-secreta",
      "token-do-widget",
    );
  });
});
