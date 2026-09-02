import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ThemeProvider } from "@/design-system/theme/theme-provider";

import { AuthRepositoryProvider } from "../data/auth-repository-context";
import type { AuthRepository } from "../data/auth-repository";
import { ForgotPasswordForm } from "./forgot-password-form";

const getTurnstileSiteKey = vi.fn().mockReturnValue(undefined);
vi.mock("@/core/auth/env", () => ({
  getTurnstileSiteKey: () => getTurnstileSiteKey(),
}));

// `useTurnstile` agora lê o tema atual para o widget (achado de auditoria de
// design, 02/09/2026), então `ForgotPasswordForm` precisa de um
// `ThemeProvider` por perto — e `ThemeProvider` precisa de um `matchMedia`,
// que o jsdom não tem.
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
    signInWithPassword: vi.fn(),
    signOut: vi.fn(),
    resetPasswordForEmail: vi.fn().mockResolvedValue(undefined),
    updatePassword: vi.fn(),
    onAuthStateChange: vi.fn().mockReturnValue(() => {}),
    ...overrides,
  };

  render(
    <ThemeProvider>
      <AuthRepositoryProvider repository={repository}>
        <ForgotPasswordForm />
      </AuthRepositoryProvider>
    </ThemeProvider>,
  );

  return repository;
}

describe("ForgotPasswordForm", () => {
  it("mostra sempre a mesma mensagem de sucesso, exista ou não a conta", async () => {
    const user = userEvent.setup();
    mount();

    await user.type(screen.getByLabelText("E-mail"), "pedro@example.com");
    await user.click(
      screen.getByRole("button", { name: "Enviar link de redefinição" }),
    );

    expect(
      await screen.findByText("Verifique seu e-mail"),
    ).toBeInTheDocument();
  });

  it("sem CAPTCHA configurado, repassa undefined e funciona como sempre", async () => {
    const user = userEvent.setup();
    const repository = mount();

    await user.type(screen.getByLabelText("E-mail"), "pedro@example.com");
    await user.click(
      screen.getByRole("button", { name: "Enviar link de redefinição" }),
    );

    expect(repository.resetPasswordForEmail).toHaveBeenCalledWith(
      "pedro@example.com",
      undefined,
    );
  });
});

describe("ForgotPasswordForm — CAPTCHA", () => {
  it("desabilita o botão sem token quando o CAPTCHA está configurado", async () => {
    getTurnstileSiteKey.mockReturnValue("site-key-de-teste");
    const user = userEvent.setup();
    const repository = mount();

    await user.type(screen.getByLabelText("E-mail"), "pedro@example.com");

    const submitButton = screen.getByRole("button", {
      name: "Enviar link de redefinição",
    });
    expect(submitButton).toBeDisabled();

    await user.click(submitButton);
    expect(repository.resetPasswordForEmail).not.toHaveBeenCalled();
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
    await user.click(
      screen.getByRole("button", { name: "Enviar link de redefinição" }),
    );

    expect(repository.resetPasswordForEmail).toHaveBeenCalledWith(
      "pedro@example.com",
      "token-do-widget",
    );
    expect(reset).toHaveBeenCalled();
  });
});
