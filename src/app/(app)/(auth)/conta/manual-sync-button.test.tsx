import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ManualSyncButton } from "./manual-sync-button";

const runProfileSync = vi.fn();

vi.mock("@/composition/sync/sync-engine", () => ({
  runProfileSync: (...args: unknown[]) => runProfileSync(...args),
  resolveProfileConflictAndSync: vi.fn(),
}));

const isSupabaseConfigured = vi.fn();

vi.mock("@/core/auth/env", () => ({
  isSupabaseConfigured: () => isSupabaseConfigured(),
}));

/**
 * Achado ao vivo contra produção (02/09/2026): `profile` era a única das
 * quatro entidades que ainda exigia um clique manual até para *puxar* — um
 * conflito real de peso entre dois aparelhos ficou invisível vários dias
 * porque ninguém clicou o botão. Estes testes provam o motivo de existir do
 * `useEffect` novo: sincroniza sozinho ao montar, sem esperar nenhum clique.
 */
describe("ManualSyncButton — sincronização automática ao montar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("chama runProfileSync sozinho ao montar, sem esperar clique", async () => {
    isSupabaseConfigured.mockReturnValue(true);
    runProfileSync.mockResolvedValue({
      push: { status: "nothing-pending" },
      pull: { status: "applied" },
    });

    render(<ManualSyncButton />);

    await waitFor(() => {
      expect(runProfileSync).toHaveBeenCalledTimes(1);
    });
  });

  it("nunca chama runProfileSync quando o Supabase não está configurado", async () => {
    isSupabaseConfigured.mockReturnValue(false);

    render(<ManualSyncButton />);

    await waitFor(() => {
      expect(isSupabaseConfigured).toHaveBeenCalled();
    });
    expect(runProfileSync).not.toHaveBeenCalled();
  });

  it("mostra o cartão de conflito sozinho, sem precisar de clique nenhum", async () => {
    isSupabaseConfigured.mockReturnValue(true);
    runProfileSync.mockResolvedValue({
      push: { status: "nothing-pending" },
      pull: {
        status: "conflict",
        local: { nutrition: { weightKg: 80 } },
        remote: { nutrition: { weightKg: 84 } },
      },
    });

    render(<ManualSyncButton />);

    expect(await screen.findByText("Conflito de dados")).toBeInTheDocument();
    expect(screen.getByText("80 kg")).toBeInTheDocument();
    expect(screen.getByText("84 kg")).toBeInTheDocument();
  });

  it("fica em silêncio (sem cartão de resultado) quando o sync automático dá certo sem conflito", async () => {
    isSupabaseConfigured.mockReturnValue(true);
    runProfileSync.mockResolvedValue({
      push: { status: "pushed" },
      pull: { status: "applied" },
    });

    render(<ManualSyncButton />);

    await waitFor(() => {
      expect(runProfileSync).toHaveBeenCalledTimes(1);
    });
    expect(
      screen.queryByText(/push: pushed/),
    ).not.toBeInTheDocument();
  });

  it("um clique manual continua funcionando depois do sync automático, sem mostrar o status técnico do resultado", async () => {
    isSupabaseConfigured.mockReturnValue(true);
    runProfileSync.mockResolvedValue({
      push: { status: "nothing-pending" },
      pull: { status: "applied" },
    });

    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup();
    render(<ManualSyncButton />);

    await waitFor(() => {
      expect(runProfileSync).toHaveBeenCalledTimes(1);
    });

    await user.click(
      screen.getByRole("button", { name: "Sincronizar dados" }),
    );

    await waitFor(() => {
      expect(runProfileSync).toHaveBeenCalledTimes(2);
    });
    expect(screen.queryByText(/push: nothing-pending/)).not.toBeInTheDocument();
    expect(screen.queryByText(/pull: applied/i)).not.toBeInTheDocument();
  });

  it("mostra uma mensagem de erro legível (não o status técnico) quando o push ou pull falha", async () => {
    isSupabaseConfigured.mockReturnValue(true);
    runProfileSync.mockResolvedValue({
      push: { status: "error", message: "network down" },
      pull: { status: "not-authenticated" },
    });

    render(<ManualSyncButton />);

    expect(
      await screen.findByText("Não foi possível sincronizar agora. Tente de novo em instantes."),
    ).toBeInTheDocument();
  });
});
