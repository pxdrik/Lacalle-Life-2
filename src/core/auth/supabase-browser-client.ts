import { createBrowserClient } from "@supabase/ssr";

import { getSupabaseEnv } from "./env";

/**
 * O cliente Supabase para o navegador — a única peça de infraestrutura de
 * auth que `features/auth` importa diretamente. `createBrowserClient` (do
 * `@supabase/ssr`, não o `createClient` puro do `supabase-js`) é o que faz a
 * sessão viver em cookie em vez de só `localStorage`, para o servidor
 * conseguir lê-la também — é essa a peça que faz `middleware.ts` conseguir
 * renovar a sessão a cada request.
 *
 * Uma instância por processo do navegador, não uma por chamada: é o padrão
 * documentado do próprio Supabase para App Router.
 */
let client: ReturnType<typeof createBrowserClient> | undefined;

export function getSupabaseBrowserClient(): ReturnType<
  typeof createBrowserClient
> {
  if (client === undefined) {
    const env = getSupabaseEnv();
    client = createBrowserClient(env.url, env.anonKey);
  }

  return client;
}
