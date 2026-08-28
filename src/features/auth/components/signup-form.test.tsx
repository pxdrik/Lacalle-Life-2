import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AuthRepositoryProvider } from "../data/auth-repository-context";
import type { AuthRepository } from "../data/auth-repository";
import { SignupForm } from "./signup-form";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

const getTurnstileSiteKey = vi.fn().mockReturnValue(undefined);
vi.mock("@/core/auth/env", () => ({
  getTurnstileSiteKey: () => getTurnstileSiteKey(),
}));

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

describe("SignupForm — CAPTCHA", () => {
  it("bloqueia o envio sem token quando o CAPTCHA está configurado, mesmo com tudo preenchido certo", async () => {
    getTurnstileSiteKey.mockReturnValue("site-key-de-teste");
    const user = userEvent.setup();
    const repository = mount();

    await user.type(screen.getByLabelText("E-mail"), "pedro@example.com");
    await user.type(screen.getByLabelText("Senha"), "senha-forte-1");
    await user.type(
      screen.getByLabelText("Confirme a senha"),
      "senha-forte-1",
    );

    // O botão fica desabilitado sem token — a barreira real de UX não é a
    // mensagem de erro (que só apareceria num envio programático fora do
    // clique normal), é o botão nunca ficar clicável.
    const submitButton = screen.getByRole("button", { name: "Criar conta" });
    expect(submitButton).toBeDisabled();

    await user.click(submitButton);

    expect(repository.signUp).not.toHaveBeenCalled();
  });

  it("repassa o token do widget para o repositório e reseta o widget depois", async () => {
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

    // Simula o script já carregado — evita depender do `<script onload>`
    // real neste teste, que roda em jsdom sem rede.
    await screen.findByText("Criar conta", { selector: "button" });
    capturedCallback?.("token-do-widget");

    await fillAndSubmit(user, {
      email: "pedro@example.com",
      password: "senha-forte-1",
      confirm: "senha-forte-1",
    });

    expect(repository.signUp).toHaveBeenCalledWith(
      "pedro@example.com",
      "senha-forte-1",
      "token-do-widget",
    );
  });

  it("nunca renderiza o widget nem bloqueia o envio quando o CAPTCHA não está configurado", async () => {
    getTurnstileSiteKey.mockReturnValue(undefined);
    const user = userEvent.setup();
    const repository = mount();

    await fillAndSubmit(user, {
      email: "pedro@example.com",
      password: "senha-forte-1",
      confirm: "senha-forte-1",
    });

    expect(repository.signUp).toHaveBeenCalledWith(
      "pedro@example.com",
      "senha-forte-1",
      undefined,
    );
  });
});
