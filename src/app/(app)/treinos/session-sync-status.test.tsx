import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SessionSyncStatus } from "./session-sync-status";

const runSessionSync = vi.fn();

vi.mock("@/composition/sync/sync-engine", () => ({
  runSessionSync: (...args: unknown[]) => runSessionSync(...args),
  resolveSessionConflictAndSync: vi.fn(),
}));

const isSupabaseConfigured = vi.fn();

vi.mock("@/core/auth/env", () => ({
  isSupabaseConfigured: () => isSupabaseConfigured(),
}));

/**
 * Achado de auditoria de design (02/09/2026): "Dados salvos neste
 * dispositivo. Entre na sua conta para sincronizar." aparecia duas vezes
 * seguidas em `/treinos`. O aviso saiu de vez a pedido do Pedro (17/09),
 * e o botão manual que restava saiu também no dia seguinte (18/09) — este
 * componente agora só aparece quando há mesmo algo pra decidir ou avisar.
 */
describe("SessionSyncStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders nothing once the automatic sync is clean, no manual button", async () => {
    isSupabaseConfigured.mockReturnValue(true);
    runSessionSync.mockResolvedValue({
      push: { status: "ok" },
      pull: { status: "done", conflicts: [] },
    });
    const { container } = render(<SessionSyncStatus />);

    await waitFor(() => {
      expect(runSessionSync).toHaveBeenCalled();
    });

    expect(
      screen.queryByRole("button", { name: "Sincronizar treinos executados" }),
    ).not.toBeInTheDocument();
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when Supabase is not configured at all", () => {
    isSupabaseConfigured.mockReturnValue(false);
    const { container } = render(<SessionSyncStatus />);

    expect(container).toBeEmptyDOMElement();
  });

  it("shows an error notice, alone, when the automatic sync fails", async () => {
    isSupabaseConfigured.mockReturnValue(true);
    runSessionSync.mockRejectedValue(new Error("Falha ao sincronizar."));
    render(<SessionSyncStatus />);

    expect(await screen.findByText("Falha ao sincronizar.")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Sincronizar treinos executados" }),
    ).not.toBeInTheDocument();
  });
});
