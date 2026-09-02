import { act, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

import { onProfileChanged } from "@/features/profile/data/profile-changed";

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
    // `shouldAdvanceTime` deixa os `await` reais dos mocks resolverem
    // normalmente enquanto o `setTimeout` de `MIN_OVERLAY_MS` fica
    // controlável — `vi.advanceTimersByTime` pula os 3 segundos de verdade
    // em vez do teste esperar por eles.
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
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
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
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
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Sincronizar dados" }),
      ).toBeInTheDocument();
    });
    expect(screen.queryByText(/push: nothing-pending/)).not.toBeInTheDocument();
    expect(screen.queryByText(/pull: applied/i)).not.toBeInTheDocument();
  });

  /**
   * Achado do Pedro: clicar em "Sincronizar dados" e a tela ficar parada
   * por alguns segundos (o round-trip real contra o Supabase, ao contrário
   * de uma escrita local que termina num piscar de olhos) lia como "não
   * aconteceu nada". `SyncingOverlay` é a resposta — só aparece durante um
   * clique de verdade (`pending`), nunca durante o sync automático em
   * segundo plano.
   */
  it("mostra a tela de carregamento enquanto o clique manual está em andamento, e some quando termina", async () => {
    isSupabaseConfigured.mockReturnValue(true);
    runProfileSync.mockResolvedValueOnce({
      push: { status: "nothing-pending" },
      pull: { status: "applied" },
    });

    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<ManualSyncButton />);

    await waitFor(() => {
      expect(runProfileSync).toHaveBeenCalledTimes(1);
    });

    let resolveClick: (value: {
      push: { status: string };
      pull: { status: string };
    }) => void = () => {};
    runProfileSync.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveClick = resolve;
      }),
    );

    await user.click(
      screen.getByRole("button", { name: "Sincronizar dados" }),
    );

    expect(await screen.findByRole("status")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Sincronizar dados" }),
    ).not.toBeInTheDocument();

    await act(async () => {
      resolveClick({ push: { status: "pushed" }, pull: { status: "applied" } });
      // Deixa a resposta resolvida atravessar `syncAndReport`/
      // `notifyProfileChanged` antes de pular o mínimo de exibição —
      // senão o `advanceTimersByTime` corre antes do `setTimeout` sequer
      // existir.
      await Promise.resolve();
      await Promise.resolve();
      vi.advanceTimersByTime(3000);
    });

    expect(
      await screen.findByRole("button", { name: "Sincronizar dados" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  /**
   * Achado do Pedro: a tela de carregamento devia esperar até o número na
   * tela realmente atualizar, não só até a rede responder — os dois são
   * passos separados (`notifyProfileChanged`/`useProfile`, ver
   * `profile-changed.ts`).
   */
  it("mantém a tela de carregamento até quem assina notifyProfileChanged terminar de reler", async () => {
    isSupabaseConfigured.mockReturnValue(true);
    runProfileSync.mockResolvedValueOnce({
      push: { status: "nothing-pending" },
      pull: { status: "applied" },
    });

    let resolveReread: () => void = () => {};
    const unsubscribe = onProfileChanged(
      () =>
        new Promise<void>((resolve) => {
          resolveReread = resolve;
        }),
    );

    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<ManualSyncButton />);

    await waitFor(() => {
      expect(runProfileSync).toHaveBeenCalledTimes(1);
    });

    runProfileSync.mockResolvedValueOnce({
      push: { status: "pushed" },
      pull: { status: "applied" },
    });

    await user.click(
      screen.getByRole("button", { name: "Sincronizar dados" }),
    );

    // A rede já respondeu, mas quem assina o aviso ainda não terminou de
    // reler — a tela de carregamento continua em pé.
    expect(await screen.findByRole("status")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Sincronizar dados" }),
    ).not.toBeInTheDocument();

    await act(async () => {
      resolveReread();
      await Promise.resolve();
      await Promise.resolve();
      vi.advanceTimersByTime(3000);
    });

    expect(
      await screen.findByRole("button", { name: "Sincronizar dados" }),
    ).toBeInTheDocument();
    unsubscribe();
  });

  it("o botão Cancelar devolve a tela na hora, mesmo com a sincronização ainda em andamento", async () => {
    isSupabaseConfigured.mockReturnValue(true);
    runProfileSync.mockResolvedValueOnce({
      push: { status: "nothing-pending" },
      pull: { status: "applied" },
    });

    const { default: userEvent } = await import("@testing-library/user-event");
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<ManualSyncButton />);

    await waitFor(() => {
      expect(runProfileSync).toHaveBeenCalledTimes(1);
    });

    let resolveClick: (value: {
      push: { status: string };
      pull: { status: string };
    }) => void = () => {};
    runProfileSync.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveClick = resolve;
      }),
    );

    await user.click(
      screen.getByRole("button", { name: "Sincronizar dados" }),
    );
    expect(await screen.findByRole("status")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(
      await screen.findByRole("button", { name: "Sincronizar dados" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    // A chamada abandonada respondendo tarde não deveria fazer nada
    // reaparecer na tela.
    await act(async () => {
      resolveClick({ push: { status: "error" }, pull: { status: "error" } });
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(
      screen.queryByText("Não foi possível sincronizar agora. Tente de novo em instantes."),
    ).not.toBeInTheDocument();
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
