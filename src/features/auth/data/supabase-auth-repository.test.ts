import { describe, expect, it, vi } from "vitest";

const signUp = vi.fn().mockResolvedValue({ data: { session: null }, error: null });
const signInWithPassword = vi.fn().mockResolvedValue({ error: null });
const resetPasswordForEmail = vi.fn().mockResolvedValue({ error: null });

vi.mock("@/core/auth/supabase-browser-client", () => ({
  getSupabaseBrowserClient: () => ({
    auth: {
      signUp,
      signInWithPassword,
      resetPasswordForEmail,
      getUser: vi.fn(),
      signOut: vi.fn(),
      updateUser: vi.fn(),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
  }),
}));

/**
 * O repositório nunca decide se um `captchaToken` é válido — só repassa o
 * que recebeu para o Supabase, que é quem de fato valida contra o provedor
 * (Attack Protection, configurado no painel, nunca neste repositório). Estes
 * testes provam só o repasse: presente vira `options.captchaToken`, ausente
 * vira `undefined` — nunca inventado, nunca validado aqui.
 */
describe("createSupabaseAuthRepository — repasse do captchaToken", () => {
  it("signUp repassa o captchaToken recebido", async () => {
    const { createSupabaseAuthRepository } = await import("./supabase-auth-repository");
    const repository = createSupabaseAuthRepository();

    await repository.signUp("a@b.com", "senha12345", "token-real");

    expect(signUp).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "a@b.com",
        password: "senha12345",
        options: expect.objectContaining({ captchaToken: "token-real" }),
      }),
    );
  });

  it("signUp sem captchaToken manda options.captchaToken undefined", async () => {
    const { createSupabaseAuthRepository } = await import("./supabase-auth-repository");
    const repository = createSupabaseAuthRepository();

    await repository.signUp("a@b.com", "senha12345");

    expect(signUp).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({ captchaToken: undefined }),
      }),
    );
  });

  it("signInWithPassword repassa o captchaToken recebido", async () => {
    const { createSupabaseAuthRepository } = await import("./supabase-auth-repository");
    const repository = createSupabaseAuthRepository();

    await repository.signInWithPassword("a@b.com", "senha12345", "token-real");

    expect(signInWithPassword).toHaveBeenCalledWith(
      expect.objectContaining({
        options: { captchaToken: "token-real" },
      }),
    );
  });

  it("resetPasswordForEmail repassa o captchaToken recebido", async () => {
    const { createSupabaseAuthRepository } = await import("./supabase-auth-repository");
    const repository = createSupabaseAuthRepository();

    await repository.resetPasswordForEmail("a@b.com", "token-real");

    expect(resetPasswordForEmail).toHaveBeenCalledWith(
      "a@b.com",
      expect.objectContaining({ captchaToken: "token-real" }),
    );
  });

  it("signUp com sessão presente devolve status signed-in", async () => {
    signUp.mockResolvedValueOnce({
      data: { session: { access_token: "t" }, user: { identities: [{ id: "1" }] } },
      error: null,
    });
    const { createSupabaseAuthRepository } = await import("./supabase-auth-repository");
    const repository = createSupabaseAuthRepository();

    await expect(repository.signUp("a@b.com", "senha12345")).resolves.toEqual({
      status: "signed-in",
    });
  });

  it("signUp sem sessão e com identidade nova devolve status check-email", async () => {
    signUp.mockResolvedValueOnce({
      data: { session: null, user: { identities: [{ id: "1" }] } },
      error: null,
    });
    const { createSupabaseAuthRepository } = await import("./supabase-auth-repository");
    const repository = createSupabaseAuthRepository();

    await expect(repository.signUp("a@b.com", "senha12345")).resolves.toEqual({
      status: "check-email",
    });
  });

  it("signUp sem sessão e identidades vazias (e-mail já cadastrado) devolve status already-registered — achado real: o Pedro tentou entrar de novo numa conta já criada e o app prometeu um e-mail que nunca chegou", async () => {
    signUp.mockResolvedValueOnce({
      data: { session: null, user: { identities: [] } },
      error: null,
    });
    const { createSupabaseAuthRepository } = await import("./supabase-auth-repository");
    const repository = createSupabaseAuthRepository();

    await expect(repository.signUp("a@b.com", "senha12345")).resolves.toEqual({
      status: "already-registered",
    });
  });

  it("um token forjado (\"true\", string arbitrária) não é tratado diferente — só repassado, quem recusa é o Supabase", async () => {
    signInWithPassword.mockResolvedValueOnce({
      error: { message: "captcha verification process failed", code: "captcha_failed" },
    });
    const { createSupabaseAuthRepository } = await import("./supabase-auth-repository");
    const repository = createSupabaseAuthRepository();

    await expect(
      repository.signInWithPassword("a@b.com", "senha12345", "true"),
    ).rejects.toMatchObject({ code: "captcha_failed" });
  });
});
