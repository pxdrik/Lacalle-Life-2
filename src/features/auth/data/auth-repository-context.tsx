"use client";

import { createContext, useContext } from "react";

import type { AuthRepository } from "./auth-repository";

const AuthRepositoryContext = createContext<AuthRepository | null>(null);

/**
 * Sem `Promise<AuthRepository>` como os outros repositórios — ao contrário
 * de uma store IndexedDB, o cliente Supabase não tem abertura assíncrona:
 * `createSupabaseAuthRepository()` é síncrono, então não há nada a esperar.
 */
export function AuthRepositoryProvider({
  repository,
  children,
}: {
  readonly repository: AuthRepository;
  readonly children: React.ReactNode;
}) {
  return (
    <AuthRepositoryContext value={repository}>
      {children}
    </AuthRepositoryContext>
  );
}

export function useAuthRepository(): AuthRepository {
  const repository = useContext(AuthRepositoryContext);

  if (repository === null) {
    throw new Error(
      "useAuthRepository must be used within an AuthRepositoryProvider.",
    );
  }

  return repository;
}
