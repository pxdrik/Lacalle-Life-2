import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { debouncedKeyedTrigger, debouncedTrigger } from "./debounce";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("debouncedTrigger", () => {
  it("colapsa uma rajada de chamadas num único disparo, depois da janela passar", () => {
    const fire = vi.fn();
    const trigger = debouncedTrigger(fire, 1000);

    trigger();
    vi.advanceTimersByTime(400);
    trigger();
    vi.advanceTimersByTime(400);
    trigger();
    expect(fire).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1000);
    expect(fire).toHaveBeenCalledTimes(1);
  });

  it("dispara de novo depois de uma janela quieta seguida de outra chamada", () => {
    const fire = vi.fn();
    const trigger = debouncedTrigger(fire, 1000);

    trigger();
    vi.advanceTimersByTime(1000);
    expect(fire).toHaveBeenCalledTimes(1);

    trigger();
    vi.advanceTimersByTime(1000);
    expect(fire).toHaveBeenCalledTimes(2);
  });
});

describe("debouncedKeyedTrigger", () => {
  it("cada chave tem sua própria janela — uma não reinicia nem cancela a outra", () => {
    const fire = vi.fn();
    const trigger = debouncedKeyedTrigger(fire, 1000);

    trigger("2026-08-25");
    vi.advanceTimersByTime(600);
    trigger("2026-08-26");
    vi.advanceTimersByTime(400);
    // A chave de 25/08 já passou da janela dela (1000ms desde a primeira
    // chamada) — dispara sozinha, sem esperar a de 26/08.
    expect(fire).toHaveBeenCalledTimes(1);
    expect(fire).toHaveBeenCalledWith("2026-08-25");

    vi.advanceTimersByTime(600);
    expect(fire).toHaveBeenCalledTimes(2);
    expect(fire).toHaveBeenCalledWith("2026-08-26");
  });

  it("chamadas repetidas para a mesma chave colapsam num disparo só", () => {
    const fire = vi.fn();
    const trigger = debouncedKeyedTrigger(fire, 1000);

    trigger("2026-08-25");
    vi.advanceTimersByTime(400);
    trigger("2026-08-25");
    vi.advanceTimersByTime(1000);

    expect(fire).toHaveBeenCalledTimes(1);
  });
});
