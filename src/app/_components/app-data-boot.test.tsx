import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { dayKey } from "@/core/format/day";

import { AppDataBoot } from "./app-data-boot";

vi.mock("@/composition/data-providers", () => ({
  FoodLogDataProvider: ({ children }: { readonly children: React.ReactNode }) =>
    children,
  WorkoutDataProvider: ({ children }: { readonly children: React.ReactNode }) =>
    children,
  BodyDataProvider: ({ children }: { readonly children: React.ReactNode }) =>
    children,
}));

const runProfileSync = vi.fn();
const runDietSync = vi.fn();
const runRoutineSync = vi.fn();
const runSessionSync = vi.fn();
const runBodyEntrySync = vi.fn();
const runFoodLogSync = vi.fn();

vi.mock("@/composition/sync/sync-engine", () => ({
  runProfileSync: () => runProfileSync(),
  runDietSync: () => runDietSync(),
  runRoutineSync: () => runRoutineSync(),
  runSessionSync: () => runSessionSync(),
  runBodyEntrySync: () => runBodyEntrySync(),
  runFoodLogSync: (day: string) => runFoodLogSync(day),
}));

const isSupabaseConfigured = vi.fn();
vi.mock("@/core/auth/env", () => ({
  isSupabaseConfigured: () => isSupabaseConfigured(),
}));

/**
 * RM11 (roadmap 23/09/2026) — pré-aquece todos os repositórios e dispara o
 * pull de cada domínio uma vez, ao montar o app, em vez de cada aba só
 * começar isso na primeira vez que alguém entra nela.
 */
describe("AppDataBoot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const sync of [
      runProfileSync,
      runDietSync,
      runRoutineSync,
      runSessionSync,
      runBodyEntrySync,
      runFoodLogSync,
    ]) {
      sync.mockResolvedValue({ push: { status: "ok" }, pull: { status: "ok" } });
    }
  });

  it("renders the children through every repository provider", () => {
    isSupabaseConfigured.mockReturnValue(true);
    render(
      <AppDataBoot>
        <p>Conteúdo do app</p>
      </AppDataBoot>,
    );

    expect(screen.getByText("Conteúdo do app")).toBeInTheDocument();
  });

  it("syncs every domain once, and the food log for today", async () => {
    isSupabaseConfigured.mockReturnValue(true);
    // `dayKey`, não `toISOString().slice(0, 10)`: a mesma UTC-vs-local que
    // `dayKey` existe pra evitar já tinha feito este teste falhar de
    // verdade, depois das 21h local, num fuso atrás de UTC.
    const today = dayKey(new Date());
    render(<AppDataBoot>{null}</AppDataBoot>);

    await waitFor(() => {
      expect(runProfileSync).toHaveBeenCalledOnce();
      expect(runDietSync).toHaveBeenCalledOnce();
      expect(runRoutineSync).toHaveBeenCalledOnce();
      expect(runSessionSync).toHaveBeenCalledOnce();
      expect(runBodyEntrySync).toHaveBeenCalledOnce();
    });
    expect(runFoodLogSync).toHaveBeenCalledExactlyOnceWith(today);
  });

  // Achado real (26/08/2026, ver `food-log-sync-status.test.tsx`): chamar
  // um sync sem Supabase configurado logava a mesma exceção em todo mount.
  // Aqui o risco é seis vezes maior — um por domínio — se a guarda faltar.
  it("attempts no sync at all when Supabase is not configured", async () => {
    isSupabaseConfigured.mockReturnValue(false);
    render(<AppDataBoot>{null}</AppDataBoot>);

    await waitFor(() => {
      expect(isSupabaseConfigured).toHaveBeenCalled();
    });
    expect(runProfileSync).not.toHaveBeenCalled();
    expect(runDietSync).not.toHaveBeenCalled();
    expect(runRoutineSync).not.toHaveBeenCalled();
    expect(runSessionSync).not.toHaveBeenCalled();
    expect(runBodyEntrySync).not.toHaveBeenCalled();
    expect(runFoodLogSync).not.toHaveBeenCalled();
  });

  it("never throws when a domain sync rejects — silent, the real screen retries", async () => {
    isSupabaseConfigured.mockReturnValue(true);
    runDietSync.mockRejectedValue(new Error("offline"));

    expect(() => render(<AppDataBoot>{null}</AppDataBoot>)).not.toThrow();
    await waitFor(() => {
      expect(runDietSync).toHaveBeenCalledOnce();
    });
  });
});
