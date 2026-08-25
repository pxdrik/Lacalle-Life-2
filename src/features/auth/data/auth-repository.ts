import type { AuthUser } from "../types/auth-user";

/**
 * A fronteira de persistência de auth — o análogo de `ProfileRepository`
 * para conta, não para dado de domínio. Componentes e hooks dependem só
 * disto, nunca do cliente Supabase diretamente (mesma regra 4 do
 * `AGENTS.md`, estendida de storage para auth).
 *
 * Só o que a Sprint de Auth isolada precisa: cadastro, login, logout, sessão
 * persistente e recuperação de senha. Nada de domínio, nada de sincronização
 * — ver `docs/arquitetura-sincronizacao.md`.
 */
export interface AuthRepository {
  /** `null` sem sessão. Nunca lança — ausência de sessão não é erro. */
  getUser(): Promise<AuthUser | null>;

  /**
   * `needsEmailConfirmation` é `true` quando o projeto exige confirmar o
   * e-mail antes da sessão valer — a UI usa isso para mostrar "confira sua
   * caixa de entrada" em vez de tratar como login imediato.
   */
  signUp(
    email: string,
    password: string,
  ): Promise<{ readonly needsEmailConfirmation: boolean }>;

  signInWithPassword(email: string, password: string): Promise<void>;

  signOut(): Promise<void>;

  /** Envia o e-mail com o link de redefinição. Nunca revela se o e-mail existe. */
  resetPasswordForEmail(email: string): Promise<void>;

  /** Chamado só depois do link de redefinição — a sessão já existe nesse ponto. */
  updatePassword(newPassword: string): Promise<void>;

  /**
   * Notifica login, logout e renovação de token. Devolve a função de
   * cancelamento — quem assina também tem que conseguir desligar.
   */
  onAuthStateChange(
    callback: (user: AuthUser | null) => void,
  ): () => void;
}
