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
   * `"signed-in"`: sessão criada na hora (confirmação de e-mail desligada
   * no projeto). `"check-email"`: cadastro novo, e-mail de confirmação
   * enviado — a UI mostra "confira sua caixa de entrada". `"already-registered"`:
   * o e-mail já tem conta confirmada; o Supabase responde sucesso (nunca
   * erro, pra não confirmar por erro que o e-mail existe) mas não manda
   * e-mail nenhum — sem tratar esse caso à parte, a pessoa cai num "confira
   * seu e-mail" que nunca chega, exatamente o que aconteceu com o Pedro em
   * 31/08/2026 tentando entrar de novo numa conta já criada. Detectado via
   * `data.user.identities` vazio, o mesmo sinal documentado pelo próprio
   * Supabase para essa distinção client-side.
   *
   * `captchaToken`, quando o CAPTCHA está configurado (ver
   * `TurnstileWidget`), é repassado ao Supabase — é o próprio servidor de
   * Auth quem valida o token contra o provedor; nada aqui confia no que o
   * navegador diz. `undefined` quando o CAPTCHA não está ligado neste
   * ambiente, e o Supabase simplesmente ignora o parâmetro ausente.
   */
  signUp(
    email: string,
    password: string,
    captchaToken?: string,
  ): Promise<{ readonly status: "signed-in" | "check-email" | "already-registered" }>;

  signInWithPassword(
    email: string,
    password: string,
    captchaToken?: string,
  ): Promise<void>;

  signOut(): Promise<void>;

  /** Envia o e-mail com o link de redefinição. Nunca revela se o e-mail existe. */
  resetPasswordForEmail(email: string, captchaToken?: string): Promise<void>;

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
