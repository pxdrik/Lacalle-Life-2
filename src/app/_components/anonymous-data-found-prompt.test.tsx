import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AnonymousDataFoundPrompt } from "./anonymous-data-found-prompt";

const isSupabaseConfigured = vi.fn();
vi.mock("@/core/auth/env", () => ({
  isSupabaseConfigured: () => isSupabaseConfigured(),
}));

const getCurrentIdentity = vi.fn();
vi.mock("@/composition/identity", () => ({
  getCurrentIdentity: () => getCurrentIdentity(),
}));

const anonymousDataExists = vi.fn();
const currentIdentityHasData = vi.fn();
vi.mock("@/composition/backup", () => ({
  anonymousDataExists: () => anonymousDataExists(),
  currentIdentityHasData: () => currentIdentityHasData(),
}));

const migrateAnonymousDataToCurrentIdentity = vi.fn();
vi.mock("@/composition/migrate-anonymous-data", () => ({
  migrateAnonymousDataToCurrentIdentity: () =>
    migrateAnonymousDataToCurrentIdentity(),
}));

/**
 * "Encontramos dados salvos neste dispositivo" — só aparece quando a conta
 * está autenticada, nunca teve dado próprio neste aparelho, e o banco
 * anônimo tem algo de verdade. As duas escolhas nunca misturam dado sem
 * uma ação explícita (Fase 3 da correção de isolamento).
 */
describe("AnonymousDataFoundPrompt", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    isSupabaseConfigured.mockReturnValue(true);
  });

  it("não faz nada sem Supabase configurado", async () => {
    isSupabaseConfigured.mockReturnValue(false);
    render(<AnonymousDataFoundPrompt />);

    await waitFor(() => {
      expect(getCurrentIdentity).not.toHaveBeenCalled();
    });
  });

  it("não aparece para quem está sem conta", async () => {
    getCurrentIdentity.mockResolvedValue({ kind: "anonymous" });
    render(<AnonymousDataFoundPrompt />);

    await waitFor(() => {
      expect(getCurrentIdentity).toHaveBeenCalled();
    });
    expect(currentIdentityHasData).not.toHaveBeenCalled();
    // O título do diálogo fica sempre no DOM (o `<dialog>` controla
    // visibilidade nativa, não montagem condicional) — o sinal real de
    // "não apareceu" é o próprio `<dialog>` nunca abrir.
    expect(document.querySelector("dialog")?.open).not.toBe(true);
  });

  it("não aparece quando a conta já tem dado próprio neste aparelho", async () => {
    getCurrentIdentity.mockResolvedValue({
      kind: "authenticated",
      uid: "user-1",
    });
    currentIdentityHasData.mockResolvedValue(true);
    anonymousDataExists.mockResolvedValue(true);
    render(<AnonymousDataFoundPrompt />);

    await waitFor(() => {
      expect(currentIdentityHasData).toHaveBeenCalled();
    });
    // O título do diálogo fica sempre no DOM (o `<dialog>` controla
    // visibilidade nativa, não montagem condicional) — o sinal real de
    // "não apareceu" é o próprio `<dialog>` nunca abrir.
    expect(document.querySelector("dialog")?.open).not.toBe(true);
  });

  it("não aparece quando o banco anônimo está vazio", async () => {
    getCurrentIdentity.mockResolvedValue({
      kind: "authenticated",
      uid: "user-1",
    });
    currentIdentityHasData.mockResolvedValue(false);
    anonymousDataExists.mockResolvedValue(false);
    render(<AnonymousDataFoundPrompt />);

    await waitFor(() => {
      expect(anonymousDataExists).toHaveBeenCalled();
    });
    // O título do diálogo fica sempre no DOM (o `<dialog>` controla
    // visibilidade nativa, não montagem condicional) — o sinal real de
    // "não apareceu" é o próprio `<dialog>` nunca abrir.
    expect(document.querySelector("dialog")?.open).not.toBe(true);
  });

  it("aparece quando a conta é nova neste aparelho e há dado anônimo real", async () => {
    getCurrentIdentity.mockResolvedValue({
      kind: "authenticated",
      uid: "user-1",
    });
    currentIdentityHasData.mockResolvedValue(false);
    anonymousDataExists.mockResolvedValue(true);
    render(<AnonymousDataFoundPrompt />);

    expect(
      await screen.findByText("Encontramos dados salvos neste dispositivo"),
    ).toBeInTheDocument();
  });

  it('"Começar do zero" fecha sem migrar nada', async () => {
    getCurrentIdentity.mockResolvedValue({
      kind: "authenticated",
      uid: "user-1",
    });
    currentIdentityHasData.mockResolvedValue(false);
    anonymousDataExists.mockResolvedValue(true);
    render(<AnonymousDataFoundPrompt />);

    await screen.findByText("Encontramos dados salvos neste dispositivo");
    await waitFor(() => {
      expect(document.querySelector("dialog")?.open).toBe(true);
    });
    await userEvent.click(
      screen.getByRole("button", { name: "Começar do zero" }),
    );

    expect(migrateAnonymousDataToCurrentIdentity).not.toHaveBeenCalled();
    expect(localStorage.getItem("lacalle-life.migration-offered.user-1")).toBe(
      "1",
    );
  });

  it('"Adicionar meus dados" migra explicitamente', async () => {
    getCurrentIdentity.mockResolvedValue({
      kind: "authenticated",
      uid: "user-1",
    });
    currentIdentityHasData.mockResolvedValue(false);
    anonymousDataExists.mockResolvedValue(true);
    migrateAnonymousDataToCurrentIdentity.mockResolvedValue({
      ok: true,
      recordCount: 3,
      sanitizedCount: 0,
      discardedCount: 0,
    });

    const reload = vi.fn();
    const originalLocation = window.location;
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...originalLocation, reload },
    });

    render(<AnonymousDataFoundPrompt />);

    await screen.findByText("Encontramos dados salvos neste dispositivo");
    await waitFor(() => {
      expect(document.querySelector("dialog")?.open).toBe(true);
    });
    await userEvent.click(
      screen.getByRole("button", { name: "Adicionar meus dados" }),
    );

    await waitFor(() => {
      expect(migrateAnonymousDataToCurrentIdentity).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(reload).toHaveBeenCalled();
    });
    expect(localStorage.getItem("lacalle-life.migration-offered.user-1")).toBe(
      "1",
    );

    Object.defineProperty(window, "location", {
      configurable: true,
      value: originalLocation,
    });
  });

  it("não pergunta de novo depois de já ter sido oferecido para esta conta", async () => {
    localStorage.setItem("lacalle-life.migration-offered.user-1", "1");
    getCurrentIdentity.mockResolvedValue({
      kind: "authenticated",
      uid: "user-1",
    });
    render(<AnonymousDataFoundPrompt />);

    await waitFor(() => {
      expect(getCurrentIdentity).toHaveBeenCalled();
    });
    expect(currentIdentityHasData).not.toHaveBeenCalled();
    expect(anonymousDataExists).not.toHaveBeenCalled();
  });
});
