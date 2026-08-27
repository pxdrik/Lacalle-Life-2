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

const getUser = vi.fn();
const onAuthStateChange = vi.fn();

vi.mock("@/features/auth/data/supabase-auth-repository", () => ({
  createSupabaseAuthRepository: () => ({
    getUser: () => getUser(),
    onAuthStateChange: (callback: (user: unknown) => void) => {
      onAuthStateChange(callback);
      return () => {};
    },
  }),
}));

// Found 26/08/2026 by an external audit: a production deploy missing its
// Supabase env vars made this effect throw on every day it mounted for,
// logging the same exception repeatedly and showing an alarming "Falha ao
// sincronizar." Notice for a state that is not a failure of anything that
// happened this session.
describe("FoodLogSyncStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUser.mockResolvedValue(null);
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

  it("syncs normally when Supabase is configured", async () => {
    isSupabaseConfigured.mockReturnValue(true);
    getUser.mockResolvedValue({ id: "u1", email: "a@b.com" });
    runFoodLogSync.mockResolvedValue({
      push: { status: "ok" },
      pull: { status: "ok" },
    });
    render(<FoodLogSyncStatus day="2026-08-26" />);

    await waitFor(() => {
      expect(runFoodLogSync).toHaveBeenCalledWith("2026-08-26");
    });
  });

  /**
   * Achado de auditoria externa (27/08/2026, UX-01): sem sessão, o botão
   * "Sincronizar" existia e não fazia nada visível ao ser tocado — o motor
   * já recusa em silêncio (`pushFoodLog`/`pullFoodLog` voltam
   * "not-authenticated"), então o clique morto não tinha explicação nenhuma
   * na tela.
   */
  it("replaces the sync button with a discrete message when there is no session", async () => {
    isSupabaseConfigured.mockReturnValue(true);
    getUser.mockResolvedValue(null);
    render(<FoodLogSyncStatus day="2026-08-26" />);

    expect(
      await screen.findByText(
        "Dados salvos neste dispositivo. Entre na sua conta para sincronizar.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Sincronizar" }),
    ).not.toBeInTheDocument();
  });

  it("shows the sync button, not the message, once a session exists", async () => {
    isSupabaseConfigured.mockReturnValue(true);
    getUser.mockResolvedValue({ id: "u1", email: "a@b.com" });
    render(<FoodLogSyncStatus day="2026-08-26" />);

    expect(
      await screen.findByRole("button", { name: "Sincronizar" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/Entre na sua conta para sincronizar/),
    ).not.toBeInTheDocument();
  });

  it("shows the same discrete message when Supabase is not configured at all", async () => {
    isSupabaseConfigured.mockReturnValue(false);
    render(<FoodLogSyncStatus day="2026-08-26" />);

    expect(
      await screen.findByText(
        "Dados salvos neste dispositivo. Entre na sua conta para sincronizar.",
      ),
    ).toBeInTheDocument();
    expect(getUser).not.toHaveBeenCalled();
  });
});
