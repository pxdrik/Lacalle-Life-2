import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

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
    runFoodLogSync.mockResolvedValue({
      push: { status: "ok" },
      pull: { status: "ok" },
    });
    render(<FoodLogSyncStatus day="2026-08-26" />);

    await waitFor(() => {
      expect(runFoodLogSync).toHaveBeenCalledWith("2026-08-26");
    });
  });
});
