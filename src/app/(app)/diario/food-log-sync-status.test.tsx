import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { FoodLogSyncStatus } from "./food-log-sync-status";

const runFoodLogSync = vi.fn();

vi.mock("@/composition/sync/sync-engine", () => ({
  runFoodLogSync: (...args: unknown[]) => runFoodLogSync(...args),
  resolveFoodLogConflictAndSync: vi.fn(),
}));

const isSupabaseConfigured = vi.fn();

vi.mock("@/core/auth/env", () => ({
  isSupabaseConfigured: () => isSupabaseConfigured(),
}));

// Found 26/08/2026 by an external audit: a production deploy missing its
// Supabase env vars made this effect throw on every day it mounted for,
// logging the same exception repeatedly and showing an alarming "Falha ao
// sincronizar." Notice for a state that is not a failure of anything that
// happened this session.
describe("FoodLogSyncStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not attempt to sync, or show an error, when Supabase is not configured", async () => {
    isSupabaseConfigured.mockReturnValue(false);
    render(<FoodLogSyncStatus day="2026-08-26" />);

    // Give the effect a turn to run before asserting it stayed quiet.
    await waitFor(() => {
      expect(isSupabaseConfigured).toHaveBeenCalled();
    });

    expect(runFoodLogSync).not.toHaveBeenCalled();
    expect(screen.queryByText(/Falha ao sincronizar/)).not.toBeInTheDocument();
    expect(
      screen.queryByText(/não está definida/),
    ).not.toBeInTheDocument();
  });

  it("syncs automatically and shows nothing, no manual button, once it's clean", async () => {
    isSupabaseConfigured.mockReturnValue(true);
    runFoodLogSync.mockResolvedValue({
      push: { status: "ok" },
      pull: { status: "ok" },
    });
    const { container } = render(<FoodLogSyncStatus day="2026-08-26" />);

    await waitFor(() => {
      expect(runFoodLogSync).toHaveBeenCalledWith("2026-08-26");
    });

    expect(
      screen.queryByRole("button", { name: "Sincronizar" }),
    ).not.toBeInTheDocument();
    expect(container).toBeEmptyDOMElement();
  });

  /**
   * Pedido do Pedro (18/09/2026): nem o botão manual de sincronizar
   * aparece mais, com sessão ou sem — só uma falha real do auto-sync
   * ainda mostra algo.
   */
  it("shows an error notice, alone, when the automatic sync fails", async () => {
    isSupabaseConfigured.mockReturnValue(true);
    runFoodLogSync.mockRejectedValue(new Error("Falha ao sincronizar."));
    render(<FoodLogSyncStatus day="2026-08-26" />);

    expect(await screen.findByText("Falha ao sincronizar.")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Sincronizar" }),
    ).not.toBeInTheDocument();
  });

  it("shows nothing when Supabase is not configured at all", () => {
    isSupabaseConfigured.mockReturnValue(false);
    const { container } = render(<FoodLogSyncStatus day="2026-08-26" />);

    expect(container).toBeEmptyDOMElement();
  });
});
