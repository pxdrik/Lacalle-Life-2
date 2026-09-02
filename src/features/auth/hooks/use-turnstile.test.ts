import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ThemeProvider } from "@/design-system/theme/theme-provider";

const getTurnstileSiteKey = vi.fn();

vi.mock("@/core/auth/env", () => ({
  getTurnstileSiteKey: () => getTurnstileSiteKey(),
}));

// `useTurnstile` agora lê o tema atual (achado de auditoria de design,
// 02/09/2026 — o widget nascia sempre no tema claro da Cloudflare, quebrando
// a identidade visual escura do app), então todo `renderHook` daqui em
// diante precisa de um `ThemeProvider` por perto — e `ThemeProvider` precisa
// de um `matchMedia`, que o jsdom não tem.
beforeEach(() => {
  vi.stubGlobal("matchMedia", (media: string) => ({
    media,
    matches: false,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
});

afterEach(() => {
  vi.clearAllMocks();
  delete (window as { turnstile?: unknown }).turnstile;
  document
    .querySelectorAll('script[src*="challenges.cloudflare.com"]')
    .forEach((el) => {
      el.remove();
    });
});

describe("useTurnstile", () => {
  it("não monta nada quando o CAPTCHA não está configurado", async () => {
    getTurnstileSiteKey.mockReturnValue(undefined);
    const { useTurnstile } = await import("./use-turnstile");
    const { result } = renderHook(() => useTurnstile(), {
      wrapper: ThemeProvider,
    });

    expect(result.current.siteKey).toBeUndefined();
    expect(result.current.token).toBe("");
    expect(
      document.querySelector('script[src*="challenges.cloudflare.com"]'),
    ).toBeNull();
  });

  it("carrega o script e renderiza o widget quando há site key", async () => {
    getTurnstileSiteKey.mockReturnValue("site-key-de-teste");
    const render = vi.fn().mockReturnValue("widget-1");
    const { useTurnstile } = await import("./use-turnstile");
    const { result } = renderHook(() => useTurnstile(), {
      wrapper: ThemeProvider,
    });

    // O container só existe depois que o componente que usa o ref monta —
    // aqui simulamos isso escrevendo o `.current` na mão, do jeito que
    // `renderHook` sem um componente real exigiria.
    const container = document.createElement("div");
    result.current.containerRef.current = container;

    await act(async () => {
      window.turnstile = { render, reset: vi.fn(), remove: vi.fn() };
      const script = document.querySelector(
        'script[src*="challenges.cloudflare.com"]',
      );
      script?.dispatchEvent(new Event("load"));
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(render).toHaveBeenCalledWith(
        container,
        expect.objectContaining({ sitekey: "site-key-de-teste" }),
      );
    });
  });

  /**
   * Achado de auditoria de design (02/09/2026): o widget sempre nascia no
   * tema claro padrão da Cloudflare — cinza-claro com o logotipo laranja —
   * quebrando a identidade escura das telas de Entrar/Criar conta. O tema
   * padrão do app é escuro (`DEFAULT_THEME`, resolvido por `ThemeProvider`
   * sem preferência salva), então é isso que o widget deve receber.
   */
  it("passa o tema atual da aplicação para o widget", async () => {
    getTurnstileSiteKey.mockReturnValue("site-key-de-teste");
    const render = vi.fn().mockReturnValue("widget-1");
    const { useTurnstile } = await import("./use-turnstile");
    const { result } = renderHook(() => useTurnstile(), {
      wrapper: ThemeProvider,
    });
    result.current.containerRef.current = document.createElement("div");

    await act(async () => {
      window.turnstile = { render, reset: vi.fn(), remove: vi.fn() };
      document
        .querySelector('script[src*="challenges.cloudflare.com"]')
        ?.dispatchEvent(new Event("load"));
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(render).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ theme: "dark" }),
      );
    });
  });

  it("o token emitido pelo callback do Turnstile aparece em .token", async () => {
    getTurnstileSiteKey.mockReturnValue("site-key-de-teste");
    let capturedCallback: ((token: string) => void) | undefined;
    const render = vi.fn((_container, options) => {
      capturedCallback = options.callback;
      return "widget-1";
    });
    const { useTurnstile } = await import("./use-turnstile");
    const { result } = renderHook(() => useTurnstile(), {
      wrapper: ThemeProvider,
    });
    result.current.containerRef.current = document.createElement("div");

    await act(async () => {
      window.turnstile = { render, reset: vi.fn(), remove: vi.fn() };
      document
        .querySelector('script[src*="challenges.cloudflare.com"]')
        ?.dispatchEvent(new Event("load"));
      await Promise.resolve();
    });

    await waitFor(() => expect(capturedCallback).toBeDefined());

    act(() => {
      capturedCallback?.("token-emitido-pelo-widget");
    });

    expect(result.current.token).toBe("token-emitido-pelo-widget");
  });

  it("reset() limpa o token e chama window.turnstile.reset no widget certo", async () => {
    getTurnstileSiteKey.mockReturnValue("site-key-de-teste");
    let capturedCallback: ((token: string) => void) | undefined;
    const reset = vi.fn();
    const render = vi.fn((_container, options) => {
      capturedCallback = options.callback;
      return "widget-42";
    });
    const { useTurnstile } = await import("./use-turnstile");
    const { result } = renderHook(() => useTurnstile(), {
      wrapper: ThemeProvider,
    });
    result.current.containerRef.current = document.createElement("div");

    await act(async () => {
      window.turnstile = { render, reset, remove: vi.fn() };
      document
        .querySelector('script[src*="challenges.cloudflare.com"]')
        ?.dispatchEvent(new Event("load"));
      await Promise.resolve();
    });
    await waitFor(() => expect(capturedCallback).toBeDefined());
    act(() => capturedCallback?.("algum-token"));
    expect(result.current.token).toBe("algum-token");

    act(() => {
      result.current.reset();
    });

    expect(result.current.token).toBe("");
    expect(reset).toHaveBeenCalledWith("widget-42");
  });
});
