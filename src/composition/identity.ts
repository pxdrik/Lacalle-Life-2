import { isSupabaseConfigured } from "@/core/auth/env";
import { getSupabaseBrowserClient } from "@/core/auth/supabase-browser-client";

import { DATABASE_NAME } from "./migrations";

/**
 * O único lugar que decide qual identidade está ativa neste navegador e qual
 * banco IndexedDB pertence a ela. Nenhum outro módulo monta um nome de banco
 * na mão — todos os pontos que hoje abrem `"lacalle-life"` diretamente
 * (repositories, sync-engine, backup, forget-device) passam a chamar
 * `currentDatabaseName()`.
 *
 * A identidade muda de duas formas: dentro da mesma carga de página, nunca
 * (ver `getCurrentIdentity`); entre identidades, só por uma navegação
 * completa (login/logout fazem `window.location.assign`, não
 * `router.push`) — é isso que descarta o `let connection` de
 * `repositories.ts` e os `once()` de `data-providers.tsx` sem precisar de um
 * mecanismo de invalidação próprio.
 */
/** Mesmo nome que `migrations.ts` sempre usou — nenhum dado anônimo existente se move. */
export const ANONYMOUS_DATABASE_NAME = DATABASE_NAME;

export type Identity =
  | { readonly kind: "anonymous" }
  | { readonly kind: "authenticated"; readonly uid: string };

export function databaseNameFor(identity: Identity): string {
  return identity.kind === "anonymous"
    ? ANONYMOUS_DATABASE_NAME
    : `${ANONYMOUS_DATABASE_NAME}:acct:${identity.uid}`;
}

/**
 * `getSession()`, não `getUser()`: a sessão já vive em cookie no navegador
 * (`@supabase/ssr`) e ler o `uid` dela é local — `getUser()` revalida contra
 * o servidor a cada chamada, uma rede que abrir um banco local não deveria
 * esperar.
 */
async function resolveIdentity(): Promise<Identity> {
  if (typeof window === "undefined") return { kind: "anonymous" };
  if (!isSupabaseConfigured()) return { kind: "anonymous" };

  try {
    const supabase = getSupabaseBrowserClient();
    const { data } = await supabase.auth.getSession();
    const uid = data.session?.user.id;
    if (uid === undefined || uid === "") return { kind: "anonymous" };
    return { kind: "authenticated", uid };
  } catch {
    // Sessão ilegível (cookie corrompido, storage bloqueado): trata como
    // anônimo em vez de derrubar quem só queria abrir o banco local.
    return { kind: "anonymous" };
  }
}

let cached: Promise<Identity> | undefined;

/**
 * Resolvida uma vez por carga de página e reaproveitada por todo mundo que
 * chamar isto depois — mesmo padrão do `connection` de `repositories.ts`,
 * para chamadas concorrentes na mesma carga sempre concordarem sobre qual
 * identidade está ativa. Uma falha não fica em cache, a próxima chamada tenta
 * de novo.
 */
export function getCurrentIdentity(): Promise<Identity> {
  cached ??= resolveIdentity().catch((error: unknown) => {
    cached = undefined;
    throw error;
  });

  return cached;
}

export async function currentDatabaseName(): Promise<string> {
  return databaseNameFor(await getCurrentIdentity());
}
