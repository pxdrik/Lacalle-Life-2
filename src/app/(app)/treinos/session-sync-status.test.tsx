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

/**
 * Achado de auditoria de design (02/09/2026): "Dados salvos neste
 * dispositivo. Entre na sua conta para sincronizar." aparecia duas vezes
 * seguidas em `/treinos` — uma vinda de `RoutineSyncStatus`, outra deste
 * componente. `RoutineSyncStatus` é montado primeiro na página e continua
 * mostrando o aviso; este componente agora fica em silêncio quando anônimo,
 * exatamente para não repeti-lo.
 */
describe("SessionSyncStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUser.mockResolvedValue(null);
  });

  it("renders nothing when there is no session, instead of repeating the sync notice", async () => {
    isSupabaseConfigured.mockReturnValue(true);
    getUser.mockResolvedValue(null);
    const { container } = render(<SessionSyncStatus />);

    await waitFor(() => {
      expect(getUser).toHaveBeenCalled();
    });

    expect(
      screen.queryByText(/Entre na sua conta para sincronizar/),
    ).not.toBeInTheDocument();
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when Supabase is not configured at all", () => {
    isSupabaseConfigured.mockReturnValue(false);
    const { container } = render(<SessionSyncStatus />);

    expect(
      screen.queryByText(/Entre na sua conta para sincronizar/),
    ).not.toBeInTheDocument();
    expect(container).toBeEmptyDOMElement();
  });

  it("still shows its own sync button once a session exists", async () => {
    isSupabaseConfigured.mockReturnValue(true);
    getUser.mockResolvedValue({ id: "u1", email: "a@b.com" });
    render(<SessionSyncStatus />);

    expect(
      await screen.findByRole("button", { name: "Sincronizar treinos executados" }),
    ).toBeInTheDocument();
  });
});
