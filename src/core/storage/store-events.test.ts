import { describe, expect, it, vi } from "vitest";

import { notifyStoreChanged, onStoreChanged } from "./store-events";

describe("store-events", () => {
  it("avisa quem assinou o mesmo store", () => {
    const listener = vi.fn();
    onStoreChanged("diets", listener);

    notifyStoreChanged("diets");

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("nunca avisa um assinante de outro store", () => {
    const dietsListener = vi.fn();
    const routinesListener = vi.fn();
    onStoreChanged("diets", dietsListener);
    onStoreChanged("routines", routinesListener);

    notifyStoreChanged("diets");

    expect(dietsListener).toHaveBeenCalledTimes(1);
    expect(routinesListener).not.toHaveBeenCalled();
  });

  it("a função de cancelamento para de avisar", () => {
    const listener = vi.fn();
    const unsubscribe = onStoreChanged("diets", listener);

    unsubscribe();
    notifyStoreChanged("diets");

    expect(listener).not.toHaveBeenCalled();
  });

  it("avisa todo assinante do mesmo store, não só o primeiro", () => {
    const first = vi.fn();
    const second = vi.fn();
    onStoreChanged("diets", first);
    onStoreChanged("diets", second);

    notifyStoreChanged("diets");

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("notificar sem nenhum assinante não lança", () => {
    expect(() => {
      notifyStoreChanged("nunca-assinado");
    }).not.toThrow();
  });
});
