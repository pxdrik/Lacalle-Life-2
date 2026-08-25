"use client";

import { useCallback, useEffect, useState } from "react";

import { describeAuthError } from "../data/describe-auth-error";
import { useAuthRepository } from "../data/auth-repository-context";
import type { AuthUser } from "../types/auth-user";

export type AuthState =
  | { readonly status: "loading" }
  | { readonly status: "anonymous" }
  | { readonly status: "authenticated"; readonly user: AuthUser };

export interface AuthStore {
  readonly state: AuthState;
  readonly signOut: () => Promise<void>;
}

/**
 * O estado de sessão vivo — quem chama isto sabe "há alguém logado agora?"
 * sem precisar orquestrar `getUser()` e `onAuthStateChange` na mão em cada
 * tela. `useProfile` é o modelo local mais próximo; a diferença é que aqui o
 * dado muda por um evento externo (outra aba deslogando, o token expirando),
 * não só por uma chamada de `save`, daí a assinatura em vez de só um efeito
 * de carga única.
 */
export function useAuth(): AuthStore {
  const repository = useAuthRepository();
  const [state, setState] = useState<AuthState>({ status: "loading" });

  useEffect(() => {
    let active = true;

    void repository.getUser().then((user) => {
      if (!active) return;
      setState(user === null ? { status: "anonymous" } : { status: "authenticated", user });
    });

    const unsubscribe = repository.onAuthStateChange((user) => {
      if (!active) return;
      setState(user === null ? { status: "anonymous" } : { status: "authenticated", user });
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [repository]);

  const signOut = useCallback(async () => {
    try {
      await repository.signOut();
    } catch (error) {
      throw new Error(describeAuthError(error));
    }
  }, [repository]);

  return { state, signOut };
}
