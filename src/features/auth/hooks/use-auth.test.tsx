import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AuthRepositoryProvider } from "../data/auth-repository-context";
import type { AuthRepository } from "../data/auth-repository";
import type { AuthUser } from "../types/auth-user";
import { useAuth } from "./use-auth";

const USER_A: AuthUser = { id: "aaaaaaaa-0000-0000-0000-000000000000", email: "a@lacalle.test" };
const USER_B: AuthUser = { id: "bbbbbbbb-0000-0000-0000-000000000000", email: "b@lacalle.test" };

function fakeRepository(user: AuthUser | null): AuthRepository {
  return {
    getUser: vi.fn().mockResolvedValue(user),
    signUp: vi.fn(),
    signInWithPassword: vi.fn(),
    signOut: vi.fn(),
    resetPasswordForEmail: vi.fn(),
    updatePassword: vi.fn(),
    onAuthStateChange: vi.fn().mockReturnValue(() => {}),
  };
}

function Probe() {
  const { state } = useAuth();

  if (state.status === "loading") return <p>carregando</p>;
  if (state.status === "anonymous") return <p>ninguém logado</p>;
  return <p>user.id={state.user.id}</p>;
}

/**
 * O caso obrigatório que o Pedro pediu depois de aprovar a Sprint 1: nada
 * de uma conta pode sobreviver, mesmo por um instante, ao "refresh" que
 * troca de usuário. Cada `render` aqui é a mesma coisa que fechar a aba e
 * abrir de novo — um `AuthRepositoryProvider` novo, exatamente como
 * `createSupabaseAuthRepository()` é recriado do zero a cada carregamento
 * de página real, nunca reaproveitado entre contas diferentes.
 *
 * Isto não substitui a validação manual ponta a ponta contra o Supabase
 * real (login → fechar/reabrir → refresh → logout) — prova a metade que dá
 * para provar sem rede: o hook nunca inventa nem retém um usuário que o
 * repositório não relatou.
 */
describe("useAuth — sem vazamento de sessão entre contas", () => {
  it("reflete a conta A, depois desloga, depois reflete só a conta B — nunca A e B juntas", async () => {
    const { unmount: unmountA } = render(
      <AuthRepositoryProvider repository={fakeRepository(USER_A)}>
        <Probe />
      </AuthRepositoryProvider>,
    );

    expect(await screen.findByText(`user.id=${USER_A.id}`)).toBeInTheDocument();
    expect(screen.queryByText(`user.id=${USER_B.id}`)).not.toBeInTheDocument();

    // "logout" — a sessão anterior nunca deveria sobreviver ao próximo
    // provider, mas simula o passo explicitamente mesmo assim.
    unmountA();

    // "fechar a aba, abrir de novo, entrar como outra conta" — um provider
    // novo do zero, nunca o mesmo objeto de repositório de A reaproveitado.
    render(
      <AuthRepositoryProvider repository={fakeRepository(USER_B)}>
        <Probe />
      </AuthRepositoryProvider>,
    );

    expect(await screen.findByText(`user.id=${USER_B.id}`)).toBeInTheDocument();
    expect(screen.queryByText(`user.id=${USER_A.id}`)).not.toBeInTheDocument();
  });

  it("nunca mostra a conta anterior depois de um logout real (onAuthStateChange(null))", async () => {
    let notify: (user: AuthUser | null) => void = () => {};

    const repository = fakeRepository(USER_A);
    repository.onAuthStateChange = vi.fn((callback: (user: AuthUser | null) => void) => {
      notify = callback;
      return () => {};
    });

    render(
      <AuthRepositoryProvider repository={repository}>
        <Probe />
      </AuthRepositoryProvider>,
    );

    expect(await screen.findByText(`user.id=${USER_A.id}`)).toBeInTheDocument();

    notify(null);

    expect(await screen.findByText("ninguém logado")).toBeInTheDocument();
    expect(screen.queryByText(`user.id=${USER_A.id}`)).not.toBeInTheDocument();
  });
});
