import type { AuthChangeEvent, Session, User } from "@supabase/supabase-js";

import { getSupabaseBrowserClient } from "@/core/auth/supabase-browser-client";

import type { AuthRepository } from "./auth-repository";
import type { AuthUser } from "../types/auth-user";

function toAuthUser(user: User | null): AuthUser | null {
  if (user === null) return null;
  return { id: user.id, email: user.email ?? null };
}

/**
 * A única implementação de `AuthRepository` desta sprint — Supabase Auth via
 * `@supabase/ssr`. Uma segunda implementação nunca existiu para nenhum outro
 * repositório deste app (não há "auth local"), então, ao contrário de
 * `LocalBodyRepository` etc., não há um par local/remoto aqui — só este.
 */
export function createSupabaseAuthRepository(): AuthRepository {
  const supabase = getSupabaseBrowserClient();

  return {
    async getUser() {
      const { data } = await supabase.auth.getUser();
      return toAuthUser(data.user);
    },

    async signUp(email, password, captchaToken) {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          captchaToken,
        },
      });
      if (error) throw error;

      if (data.session !== null) {
        return { status: "signed-in" };
      }

      // `identities` vazio é como o Supabase sinaliza "e-mail já tinha
      // conta confirmada" sem devolver erro — devolver erro revelaria a
      // existência da conta por um canal que muda de status HTTP, o que o
      // projeto evita de propósito (mesma postura de `resetPasswordForEmail`
      // abaixo). Um cadastro genuinamente novo sempre chega com pelo menos
      // uma identidade.
      if (data.user?.identities?.length === 0) {
        return { status: "already-registered" };
      }

      return { status: "check-email" };
    },

    async signInWithPassword(email, password, captchaToken) {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
        options: { captchaToken },
      });
      if (error) throw error;
    },

    async signOut() {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    },

    async resetPasswordForEmail(email, captchaToken) {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        // Passa por `/auth/callback` para trocar o código por sessão antes
        // de chegar em `/atualizar-senha` — essa tela assume que a sessão
        // já existe, ela não recebe o código diretamente.
        redirectTo: `${window.location.origin}/auth/callback?next=/atualizar-senha`,
        captchaToken,
      });
      if (error) throw error;
    },

    async updatePassword(newPassword) {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (error) throw error;
    },

    onAuthStateChange(callback) {
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange(
        (_event: AuthChangeEvent, session: Session | null) => {
          callback(toAuthUser(session?.user ?? null));
        },
      );

      return () => {
        subscription.unsubscribe();
      };
    },
  };
}
