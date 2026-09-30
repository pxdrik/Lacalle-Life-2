import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ThemeProvider } from "@/design-system/theme/theme-provider";

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

// `useTurnstile` agora lê o tema atual para o widget (achado de auditoria de
// design, 02/09/2026), então `SignupForm` precisa de um `ThemeProvider` por
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
    signUp: vi.fn().mockResolvedValue({ status: "check-email" }),
    signInWithPassword: vi.fn(),
    signOut: vi.fn(),
    resetPasswordForEmail: vi.fn(),
    updatePassword: vi.fn(),
    onAuthStateChange: vi.fn().mockReturnValue(() => {}),
    ...overrides,
  };

  render(
    <ThemeProvider>
      <AuthRepositoryProvider repository={repository}>
        <SignupForm />
      </AuthRepositoryProvider>
    </ThemeProvider>,
  );

  return repository;
}

async function fillAndSubmit(
  user: ReturnType<typeof userEvent.setup>,
  {
    email,
    password,
    confirm,
    accept = true,
  }: { email: string; password: string; confirm: string; accept?: boolean },
) {
  await user.type(screen.getByLabelText("E-mail"), email);
  await user.type(screen.getByLabelText("Senha"), password);
  await user.type(screen.getByLabelText("Confirme a senha"), confirm);
  if (accept) await user.click(screen.getByRole("checkbox", { name: /Li e aceito/ }));
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
    mount({ signUp: vi.fn().mockResolvedValue({ status: "check-email" }) });

    await fillAndSubmit(user, {
      email: "pedro@example.com",
      password: "senha-forte-1",
      confirm: "senha-forte-1",
    });

    expect(await screen.findByText("Confira seu e-mail")).toBeInTheDocument();
  });

  it("avisa que a conta já existe em vez de prometer um e-mail que nunca vai chegar", async () => {
    const user = userEvent.setup();
    mount({ signUp: vi.fn().mockResolvedValue({ status: "already-registered" }) });

    await fillAndSubmit(user, {
      email: "pedro@example.com",
      password: "senha-forte-1",
      confirm: "senha-forte-1",
    });

    expect(await screen.findByText("Este e-mail já tem conta")).toBeInTheDocument();
    expect(screen.queryByText("Confira seu e-mail")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "entrar" })).toHaveAttribute("href", "/entrar");
    expect(screen.getByRole("link", { name: "recuperar sua senha" })).toHaveAttribute(
      "href",
      "/recuperar-senha",
    );
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

/** Roadmap 8.4 (30/09/2026): sem aceite dos Termos e da Política, não há conta. */
describe("SignupForm — aceite dos Termos e da Política", () => {
  it("começa desmarcado, com o botão desabilitado e os dois documentos em link", async () => {
    mount();

    expect(screen.getByRole("checkbox", { name: /Li e aceito/ })).not.toBeChecked();
    expect(screen.getByRole("button", { name: "Criar conta" })).toBeDisabled();
    expect(screen.getByRole("link", { name: "Termos de Uso" })).toHaveAttribute("href", "/termos-de-uso");
    expect(screen.getByRole("link", { name: "Política de Privacidade" })).toHaveAttribute(
      "href",
      "/politica-de-privacidade",
    );
  });

  it("não cria conta sem aceite nem por um envio que não passa pelo botão", async () => {
    const user = userEvent.setup();
    const repository = mount();

    await user.type(screen.getByLabelText("E-mail"), "a@b.com");
    await user.type(screen.getByLabelText("Senha"), "12345678");
    await user.type(screen.getByLabelText("Confirme a senha"), "12345678");
    // O Enter já não envia (o HTML bloqueia com o botão desabilitado); um
    // submit direto do formulário é o que só a guarda do handleSubmit segura.
    fireEvent.submit(screen.getByRole("button", { name: "Criar conta" }).closest("form")!);

    expect(repository.signUp).not.toHaveBeenCalled();
    expect(
      await screen.findByText("Para criar a conta, aceite os Termos de Uso e a Política de Privacidade."),
    ).toBeInTheDocument();
  });

  it("com aceite, cria a conta", async () => {
    const user = userEvent.setup();
    const repository = mount();

    await fillAndSubmit(user, { email: "a@b.com", password: "12345678", confirm: "12345678" });

    expect(repository.signUp).toHaveBeenCalledOnce();
  });
});
