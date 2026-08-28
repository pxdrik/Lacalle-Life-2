import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LandingRedirect } from "./landing-redirect";

const replace = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
}));

const isSupabaseConfigured = vi.fn();

vi.mock("@/core/auth/env", () => ({
  isSupabaseConfigured: () => isSupabaseConfigured(),
}));

const getUser = vi.fn();

vi.mock("@/features/auth/data/supabase-auth-repository", () => ({
  createSupabaseAuthRepository: () => ({
    getUser: () => getUser(),
  }),
}));

const hasEnteredAppBefore = vi.fn();

vi.mock("../../_lib/entered-app", () => ({
  hasEnteredAppBefore: () => hasEnteredAppBefore(),
}));

/**
 * `LandingRedirect` decide, sem bloquear a primeira renderização, se quem
 * está vendo `/` deveria estar em `/hoje`: já usou o app neste aparelho, ou
 * já tem sessão. Nenhum dos dois casos deveria travar quem está vendo o
 * produto pela primeira vez sem conta.
 */
describe("LandingRedirect", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isSupabaseConfigured.mockReturnValue(false);
    hasEnteredAppBefore.mockReturnValue(false);
    getUser.mockResolvedValue(null);
  });

  it("redirects to /hoje when this browser already used the app before", async () => {
    hasEnteredAppBefore.mockReturnValue(true);
    render(<LandingRedirect />);

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith("/hoje");
    });
    expect(getUser).not.toHaveBeenCalled();
  });

  it("does not check Supabase when it is not configured", async () => {
    isSupabaseConfigured.mockReturnValue(false);
    render(<LandingRedirect />);

    await waitFor(() => {
      expect(isSupabaseConfigured).toHaveBeenCalled();
    });
    expect(getUser).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });

  it("redirects to /hoje when there is already an authenticated session", async () => {
    isSupabaseConfigured.mockReturnValue(true);
    getUser.mockResolvedValue({ id: "u1", email: "a@b.com" });
    render(<LandingRedirect />);

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith("/hoje");
    });
  });

  it("stays on the Landing Page for a first-time, unauthenticated visitor", async () => {
    isSupabaseConfigured.mockReturnValue(true);
    getUser.mockResolvedValue(null);
    render(<LandingRedirect />);

    await waitFor(() => {
      expect(getUser).toHaveBeenCalled();
    });
    expect(replace).not.toHaveBeenCalled();
  });
});
