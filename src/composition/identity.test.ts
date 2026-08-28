import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const isSupabaseConfigured = vi.fn();
const getSession = vi.fn();

/**
 * `vi.doMock`, não `vi.mock` — o fator hoisted de `vi.mock` não sobrevive
 * limpo a `vi.resetModules()` seguido de reimportação dinâmica (mesma razão
 * pela qual `identity-isolation.test.ts` também usa `vi.doMock` dentro de
 * `freshSession()`, chamado de novo a cada "carga de página" simulada).
 */
function mockAuth() {
  vi.doMock("@/core/auth/env", () => ({
    isSupabaseConfigured: () => isSupabaseConfigured(),
  }));
  vi.doMock("@/core/auth/supabase-browser-client", () => ({
    getSupabaseBrowserClient: () => ({
      auth: { getSession: () => getSession() },
    }),
  }));
}

describe("databaseNameFor", () => {
  it("é o nome de sempre para o anônimo, sem migração para quem já usa hoje", async () => {
    const { databaseNameFor } = await import("./identity");
    expect(databaseNameFor({ kind: "anonymous" })).toBe("lacalle-life");
  });

  it("é lacalle-life:acct:<uid> para uma conta autenticada", async () => {
    const { databaseNameFor } = await import("./identity");
    expect(databaseNameFor({ kind: "authenticated", uid: "abc-123" })).toBe(
      "lacalle-life:acct:abc-123",
    );
  });
});

describe("getCurrentIdentity", () => {
  beforeEach(() => {
    vi.resetModules();
    isSupabaseConfigured.mockReset();
    getSession.mockReset();
    mockAuth();
  });

  afterEach(() => {
    vi.doUnmock("@/core/auth/env");
    vi.doUnmock("@/core/auth/supabase-browser-client");
  });

  it("é anônimo sem chamar a sessão quando o Supabase não está configurado", async () => {
    isSupabaseConfigured.mockReturnValue(false);
    const { getCurrentIdentity } = await import("./identity");

    await expect(getCurrentIdentity()).resolves.toEqual({ kind: "anonymous" });
    expect(getSession).not.toHaveBeenCalled();
  });

  it("é anônimo quando não há sessão", async () => {
    isSupabaseConfigured.mockReturnValue(true);
    getSession.mockResolvedValue({ data: { session: null } });
    const { getCurrentIdentity } = await import("./identity");

    await expect(getCurrentIdentity()).resolves.toEqual({ kind: "anonymous" });
  });

  it("é anônimo quando o uid da sessão vem vazio", async () => {
    isSupabaseConfigured.mockReturnValue(true);
    getSession.mockResolvedValue({ data: { session: { user: { id: "" } } } });
    const { getCurrentIdentity } = await import("./identity");

    await expect(getCurrentIdentity()).resolves.toEqual({ kind: "anonymous" });
  });

  it("é anônimo, não lança, quando ler a sessão falha", async () => {
    isSupabaseConfigured.mockReturnValue(true);
    getSession.mockRejectedValue(new Error("cookie ilegível"));
    const { getCurrentIdentity } = await import("./identity");

    await expect(getCurrentIdentity()).resolves.toEqual({ kind: "anonymous" });
  });

  it("é autenticada com o uid da sessão quando há uma", async () => {
    isSupabaseConfigured.mockReturnValue(true);
    getSession.mockResolvedValue({
      data: { session: { user: { id: "user-1" } } },
    });
    const { getCurrentIdentity } = await import("./identity");

    await expect(getCurrentIdentity()).resolves.toEqual({
      kind: "authenticated",
      uid: "user-1",
    });
  });

  it("memoiza — chamadas concorrentes na mesma carga de página concordam sobre a mesma identidade", async () => {
    isSupabaseConfigured.mockReturnValue(true);
    getSession.mockResolvedValue({
      data: { session: { user: { id: "user-1" } } },
    });
    const { getCurrentIdentity } = await import("./identity");

    const [first, second] = await Promise.all([
      getCurrentIdentity(),
      getCurrentIdentity(),
    ]);

    expect(first).toEqual(second);
    expect(getSession).toHaveBeenCalledTimes(1);
  });

  it("currentDatabaseName resolve o nome certo para a identidade atual", async () => {
    isSupabaseConfigured.mockReturnValue(true);
    getSession.mockResolvedValue({
      data: { session: { user: { id: "user-2" } } },
    });
    const { currentDatabaseName } = await import("./identity");

    await expect(currentDatabaseName()).resolves.toBe(
      "lacalle-life:acct:user-2",
    );
  });
});
