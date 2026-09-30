import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  SPLASH_ATTRIBUTE,
  SPLASH_SESSION_KEY,
  bootSplashScriptSource,
} from "./boot-splash-script";

/**
 * Executa o texto real do script, como `theme-script.test.ts` faz com o dele:
 * testar uma cópia não provaria nada.
 */
function runScript(): void {
  new Function(bootSplashScriptSource)();
}

beforeEach(() => {
  window.sessionStorage.clear();
  document.documentElement.removeAttribute(SPLASH_ATTRIBUTE);
});

afterEach(() => {
  vi.restoreAllMocks();
});

/** Roadmap 8.12 (30/09/2026): a transição só na abertura do app. */
describe("BootSplashScript", () => {
  it("na abertura, deixa a transição aparecer e marca a sessão", () => {
    runScript();

    expect(document.documentElement.hasAttribute(SPLASH_ATTRIBUTE)).toBe(false);
    expect(window.sessionStorage.getItem(SPLASH_SESSION_KEY)).toBe("1");
  });

  it("num recarregamento na mesma sessão, esconde a transição", () => {
    runScript();
    runScript();

    expect(document.documentElement.getAttribute(SPLASH_ATTRIBUTE)).toBe("skip");
  });

  it("com o armazenamento bloqueado, não quebra e a transição aparece", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });

    expect(runScript).not.toThrow();
    expect(document.documentElement.hasAttribute(SPLASH_ATTRIBUTE)).toBe(false);
  });
});
