import { afterEach, describe, expect, it, vi } from "vitest";

import { notifyProfileChanged, onProfileChanged } from "./profile-changed";

const unsubscribers: (() => void)[] = [];

function subscribe(listener: () => Promise<void> | void): void {
  unsubscribers.push(onProfileChanged(listener));
}

afterEach(() => {
  while (unsubscribers.length > 0) {
    unsubscribers.pop()?.();
  }
});

describe("profile-changed — sinal de perfil mudado por fora da tela", () => {
  it("chama todo assinante quando notificado", async () => {
    const listener = vi.fn();
    subscribe(listener);

    await notifyProfileChanged();

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("nunca chama um assinante depois de ele cancelar", async () => {
    const listener = vi.fn();
    const unsubscribe = onProfileChanged(listener);
    unsubscribe();

    await notifyProfileChanged();

    expect(listener).not.toHaveBeenCalled();
  });

  it("notificar sem nenhum assinante resolve na hora, sem erro", async () => {
    await expect(notifyProfileChanged()).resolves.toBeUndefined();
  });

  /**
   * Achado do Pedro: a tela de carregamento devia esperar o número
   * realmente atualizar, não só a rede responder. Isto é o que torna isso
   * possível — `notifyProfileChanged` só resolve depois que todo assinante
   * (aqui, `useProfile` relendo do repositório) já terminou.
   */
  it("espera todo assinante assíncrono terminar antes de resolver", async () => {
    let resolveListener: () => void = () => {};
    const listener = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveListener = resolve;
        }),
    );
    subscribe(listener);

    let notified = false;
    const notifyPromise = notifyProfileChanged().then(() => {
      notified = true;
    });

    await Promise.resolve();
    expect(notified).toBe(false);

    resolveListener();
    await notifyPromise;
    expect(notified).toBe(true);
  });

  it("um assinante que lança não impede outros de rodar, mas propaga a falha", async () => {
    const ok = vi.fn();
    const broken = vi.fn().mockRejectedValue(new Error("falhou"));
    subscribe(broken);
    subscribe(ok);

    await expect(notifyProfileChanged()).rejects.toThrow("falhou");
    expect(ok).toHaveBeenCalledTimes(1);
  });
});
